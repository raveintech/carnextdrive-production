import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Upload, Loader2 } from "lucide-react";

// Catalog (display only — server is authoritative)
const CARS: Record<string, { name: string; weekly: number; monthly: number }> = {
  "1": { name: "Chrysler 200", weekly: 349, monthly: 1199 },
  "2": { name: "Chevy Camaro", weekly: 399, monthly: 1349 },
  "3": { name: "Chevy Tahoe", weekly: 479, monthly: 1599 },
};

// Cloudinary cloud name
const CLOUDINARY_CLOUD_NAME =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME) ||
  "drlo4xvo8";

// Direct client-side upload to Cloudinary using unsigned preset.
// Requires unsigned upload preset named exactly: carnextdrive-uploads
async function uploadFilesToServer(
  licenseFile: File,
  idFile: File,
): Promise<{ licenseUrl: string; idUrl: string }> {
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", "carnextdrive-uploads");

    const r = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: "POST", body: fd },
    );

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let parsed: any = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        // ignore
      }
      throw new Error(
        parsed?.error?.message ||
          `Cloudinary upload failed (${r.status}). Check your upload preset and cloud name.`,
      );
    }

    const data = await r.json();
    if (!data.secure_url) {
      throw new Error("Cloudinary upload succeeded but no URL was returned.");
    }
    return data.secure_url as string;
  };

  const [licenseUrl, idUrl] = await Promise.all([
    uploadToCloudinary(licenseFile),
    uploadToCloudinary(idFile),
  ]);

  return { licenseUrl, idUrl };
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const carId = searchParams.get("carId") || "";
  const plan = (searchParams.get("plan") as "weekly" | "monthly") || "";
  const car = CARS[carId];
  const price =
    car && (plan === "weekly" || plan === "monthly")
      ? plan === "weekly"
        ? car.weekly
        : car.monthly
      : null;

  const hasSelection = useMemo(
    () =>
      Boolean(car) && (plan === "weekly" || plan === "monthly") && price !== null,
    [car, plan, price],
  );

  const STORAGE_KEY = "carnextdrive:signup-form";

  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    phone: string;
    licenseFile: File | null;
    idFile: File | null;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<{
            fullName: string;
            email: string;
            phone: string;
          }>;
          return {
            fullName: saved.fullName || "",
            email: saved.email || "",
            phone: saved.phone || "",
            licenseFile: null,
            idFile: null,
          };
        }
      } catch {
        // ignore
      }
    }
    return {
      fullName: "",
      email: "",
      phone: "",
      licenseFile: null,
      idFile: null,
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        }),
      );
    } catch {
      // ignore
    }
  }, [formData.fullName, formData.email, formData.phone]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "licenseFile" | "idFile",
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, [fileType]: file }));
  };

  const submitApplication = async () => {
    setErrorMsg(null);

    if (!hasSelection) {
      setErrorMsg(
        "Please pick a car and a plan first (Weekly or Monthly) from the vehicle page.",
      );
      return;
    }
    if (!formData.fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!formData.email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }
    if (!formData.licenseFile) {
      setErrorMsg("Please upload a photo of your driver license.");
      return;
    }
    if (!formData.idFile) {
      setErrorMsg("Please upload a photo of your ID.");
      return;
    }

    setSubmitting(true);

    try {
      let licenseUrl = "";
      let idUrl = "";

      try {
        const up = await uploadFilesToServer(
          formData.licenseFile,
          formData.idFile,
        );
        licenseUrl = up.licenseUrl;
        idUrl = up.idUrl;
      } catch (upErr: any) {
        throw new Error(
          upErr?.message ||
            "We couldn't upload your documents. Please try again.",
        );
      }

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          plan,
          customerEmail: formData.email,
          customerName: formData.fullName,
          phone: formData.phone,
          licenseUrl,
          idUrl,
          originUrl: window.location.origin,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let parsed: any = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          // not JSON
        }
        throw new Error(
          parsed?.error ||
            `Payment could not be started (server returned ${res.status}). Make sure STRIPE_SECRET_KEY is set on the server.`,
        );
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          "Something went wrong starting your payment. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void submitApplication();
    return false;
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-2xl mx-auto px-6 sm:px-12 py-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Apply for a Car
          </h1>
          <p className="text-lg text-foreground/70">
            Submit your information to get approved
          </p>
        </div>

        {hasSelection ? (
          <div
            data-testid="booking-summary"
            className="mb-8 rounded-lg border border-accent/30 bg-accent/5 p-4"
          >
            <p className="text-sm text-foreground/60 mb-1">You're booking</p>
            <p className="text-lg font-bold text-foreground">
              <span data-testid="summary-car">{car!.name}</span> ·{" "}
              <span data-testid="summary-plan" className="capitalize">
                {plan}
              </span>{" "}
              plan
            </p>
            <p className="text-accent font-bold text-xl mt-1">
              <span data-testid="summary-price">${price}</span> /{" "}
              {plan === "weekly" ? "week" : "month"} (recurring until canceled)
            </p>
            <Link
              to={`/vehicle/${carId}`}
              className="text-sm text-accent hover:underline mt-2 inline-block"
            >
              Change car or plan
            </Link>
          </div>
        ) : (
          <div
            data-testid="no-selection-warning"
            className="mb-8 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
          >
            <p className="font-bold">No car or plan selected</p>
            <p className="text-sm mt-1">
              Please{" "}
              <Link to="/" className="underline">
                pick a car
              </Link>{" "}
              and choose Weekly or Monthly first.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="signup-fullname"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="signup-email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="signup-phone"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Upload Driver License
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                onChange={(e) => handleFileChange(e, "licenseFile")}
                className="hidden"
                id="license-upload"
                accept="image/*,.pdf"
                data-testid="signup-license-input"
              />
              <label htmlFor="license-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-foreground font-medium">
                  Click to upload your license
                </p>
                <p className="text-sm text-foreground/60">
                  {formData.licenseFile
                    ? formData.licenseFile.name
                    : "PNG, JPG, or PDF"}
                </p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Upload ID
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                onChange={(e) => handleFileChange(e, "idFile")}
                className="hidden"
                id="id-upload"
                accept="image/*,.pdf"
                data-testid="signup-id-input"
              />
              <label htmlFor="id-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-foreground font-medium">
                  Click to upload your ID
                </p>
                <p className="text-sm text-foreground/60">
                  {formData.idFile ? formData.idFile.name : "PNG, JPG, or PDF"}
                </p>
              </label>
            </div>
          </div>

          {errorMsg && (
            <div
              data-testid="signup-error"
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
            >
              <span className="text-xl leading-none">⚠</span>
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={submitApplication}
            disabled={submitting || !hasSelection}
            data-testid="signup-submit-btn"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg py-3 mt-8 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Processing…
              </span>
            ) : (
              "Submit Application & Pay"
            )}
          </Button>

          <p className="text-center text-sm text-foreground/60 mt-4">
            Already have an account?{" "}
            <Link to="/dashboard" className="text-accent hover:text-accent/90">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
