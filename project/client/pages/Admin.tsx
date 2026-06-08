import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  Plus,
  Save,
  Trash2,
  Lock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import type { Car } from "@/lib/cars";

const TOKEN_KEY = "cnd_admin_token";

// Editable draft shape: numbers are kept as strings while typing, features as
// one-per-line text. Converted to the API shape on save.
interface CarDraft {
  id?: string;
  name: string;
  type: string;
  weekly: string;
  monthly: string;
  seats: string;
  image: string;
  imageCredit: string;
  description: string;
  features: string; // newline-separated
}

function toDraft(car: Car): CarDraft {
  return {
    id: car.id,
    name: car.name,
    type: car.type ?? "",
    weekly: String(car.weekly ?? ""),
    monthly: String(car.monthly ?? ""),
    seats: String(car.seats ?? ""),
    image: car.image ?? "",
    imageCredit: car.imageCredit ?? "",
    description: car.description ?? "",
    features: (car.features ?? []).join("\n"),
  };
}

function emptyDraft(): CarDraft {
  return {
    name: "",
    type: "",
    weekly: "",
    monthly: "",
    seats: "5",
    image: "",
    imageCredit: "",
    description: "",
    features: "",
  };
}

function draftToPayload(d: CarDraft) {
  return {
    name: d.name.trim(),
    type: d.type.trim(),
    weekly: Number(d.weekly),
    monthly: Number(d.monthly),
    seats: Number(d.seats),
    image: d.image.trim(),
    imageCredit: d.imageCredit.trim() || undefined,
    description: d.description.trim(),
    features: d.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
  };
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null,
  );
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [drafts, setDrafts] = useState<CarDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);
  const [newCar, setNewCar] = useState<CarDraft | null>(null);

  const clearToken = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  // Wrapper that attaches the bearer token and handles expiry (401 -> logout).
  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const res = await fetch(input, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        clearToken();
        throw new Error("Your session expired. Please log in again.");
      }
      return res;
    },
    [token, clearToken],
  );

  const loadCars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/cars");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const cars = (await res.json()) as Car[];
      setDrafts(cars.map(toDraft));
    } catch (err: any) {
      toast.error(err?.message || "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (token) void loadCars();
  }, [token, loadCars]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Incorrect password");
      }
      const { token: t } = await res.json();
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setPassword("");
      toast.success("Signed in");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<CarDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    );
  };

  const validate = (d: CarDraft): string | null => {
    if (!d.name.trim()) return "Name is required";
    if (d.weekly === "" || Number.isNaN(Number(d.weekly)) || Number(d.weekly) < 0)
      return "Weekly price must be a number ≥ 0";
    if (
      d.monthly === "" ||
      Number.isNaN(Number(d.monthly)) ||
      Number(d.monthly) < 0
    )
      return "Monthly price must be a number ≥ 0";
    return null;
  };

  const saveExisting = async (d: CarDraft) => {
    const err = validate(d);
    if (err) return toast.error(err);
    setSavingId(d.id!);
    try {
      const res = await authedFetch(`/api/admin/cars/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(d)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      const saved = (await res.json()) as Car;
      updateDraft(d.id!, toDraft(saved));
      toast.success(`Saved ${saved.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const createCar = async () => {
    if (!newCar) return;
    const err = validate(newCar);
    if (err) return toast.error(err);
    setSavingId("new");
    try {
      const res = await authedFetch("/api/admin/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(newCar)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Create failed");
      }
      const saved = (await res.json()) as Car;
      setDrafts((prev) => [...prev, toDraft(saved)]);
      setNewCar(null);
      toast.success(`Added ${saved.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Create failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteCar = async (d: CarDraft) => {
    if (!d.id) return;
    if (
      !window.confirm(
        `Delete "${d.name}"? This removes it from the public site. This cannot be undone.`,
      )
    )
      return;
    setSavingId(d.id);
    try {
      const res = await authedFetch(`/api/admin/cars/${d.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      toast.success(`Deleted ${d.name}`);
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setSavingId(null);
    }
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-md mx-auto px-6 py-20">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-accent" />
                </div>
                <CardTitle>Admin Sign In</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    data-testid="admin-password-input"
                    className="mt-1.5"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loggingIn || !password}
                  data-testid="admin-login-btn"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {loggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
              <Link
                to="/"
                className="block text-center text-sm text-foreground/60 hover:text-accent mt-6"
              >
                ← Back to site
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-5xl mx-auto px-6 sm:px-12 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Manage Listings
            </h1>
            <p className="text-foreground/60 mt-1">
              Edit pricing and details. Changes go live immediately on the
              public site.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> View site
              </Button>
            </Link>
            <Button variant="ghost" onClick={clearToken}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-foreground/60 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading listings…
          </div>
        ) : (
          <div className="space-y-6">
            {drafts.map((d) => (
              <CarForm
                key={d.id}
                draft={d}
                onChange={(patch) => updateDraft(d.id!, patch)}
                onSave={() => saveExisting(d)}
                onDelete={() => deleteCar(d)}
                saving={savingId === d.id}
              />
            ))}

            {newCar ? (
              <CarForm
                draft={newCar}
                isNew
                onChange={(patch) => setNewCar({ ...newCar, ...patch })}
                onSave={createCar}
                onDelete={() => setNewCar(null)}
                saving={savingId === "new"}
              />
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed py-6"
                onClick={() => setNewCar(emptyDraft())}
                data-testid="admin-add-car-btn"
              >
                <Plus className="w-4 h-4 mr-2" /> Add a car
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single car editor card ────────────────────────────────────────────────
function CarForm({
  draft,
  onChange,
  onSave,
  onDelete,
  saving,
  isNew = false,
}: {
  draft: CarDraft;
  onChange: (patch: Partial<CarDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const field =
    (key: keyof CarDraft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value } as Partial<CarDraft>);

  return (
    <Card data-testid={isNew ? "admin-new-car" : `admin-car-${draft.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg">
          {isNew ? "New car" : draft.name || `Car #${draft.id}`}
        </CardTitle>
        {draft.image ? (
          <img
            src={draft.image}
            alt=""
            className="w-16 h-12 object-cover rounded border border-border"
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={field("name")}
              placeholder="Chrysler 200"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Input
              value={draft.type}
              onChange={field("type")}
              placeholder="Sedan / Coupe / SUV"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Weekly price ($)</Label>
            <Input
              type="number"
              min={0}
              value={draft.weekly}
              onChange={field("weekly")}
              placeholder="349"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Monthly price ($)</Label>
            <Input
              type="number"
              min={0}
              value={draft.monthly}
              onChange={field("monthly")}
              placeholder="1199"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Seats</Label>
            <Input
              type="number"
              min={1}
              max={15}
              value={draft.seats}
              onChange={field("seats")}
              placeholder="5"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Image URL</Label>
            <Input
              value={draft.image}
              onChange={field("image")}
              placeholder="/cars/chrysler-200.jpg or https://…"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label>Image credit (optional)</Label>
          <Input
            value={draft.imageCredit}
            onChange={field("imageCredit")}
            placeholder="Photo: …"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={draft.description}
            onChange={field("description")}
            rows={3}
            placeholder="Short marketing description shown on the vehicle page."
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Features (one per line)</Label>
          <Textarea
            value={draft.features}
            onChange={field("features")}
            rows={4}
            placeholder={"Backup Camera\nBluetooth Connectivity\nClimate Control"}
            className="mt-1.5 font-mono text-sm"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isNew ? "Cancel" : "Delete"}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            data-testid={isNew ? "admin-create-save" : `admin-save-${draft.id}`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isNew ? "Create" : "Save changes"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
