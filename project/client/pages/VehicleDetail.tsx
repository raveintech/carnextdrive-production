import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Users } from "lucide-react";
import { fetchCars, FALLBACK_CARS } from "@/lib/cars";

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Live catalogue from the server (single source of truth). placeholderData
  // shows seed cars instantly while the real catalogue loads, so direct links
  // to newly-added cars still resolve once the fetch completes.
  const { data: cars = FALLBACK_CARS, isLoading } = useQuery({
    queryKey: ["cars"],
    queryFn: fetchCars,
    placeholderData: FALLBACK_CARS,
    staleTime: 30_000,
  });
  const vehicle = cars.find((c) => c.id === (id || "1"));

  const [plan, setPlan] = useState<"weekly" | "monthly">("weekly");

  if (!vehicle) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-white">
          <Navigation />
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 text-center text-foreground/60">
            Loading vehicle…
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Vehicle not found
          </h2>
          <Link to="/">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const selectedPrice =
    plan === "weekly" ? vehicle.weekly : vehicle.monthly;

  const handleBook = () => {
    navigate(
      `/signup?carId=${encodeURIComponent(id || "")}&plan=${plan}&price=${selectedPrice}`,
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="text-accent hover:text-accent/90 font-medium mb-8 inline-block"
        >
          ← Back to Cars
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Vehicle Image */}
          <div className="relative h-96 lg:h-full min-h-96 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={vehicle.image}
              alt={vehicle.name}
              className="w-full h-full object-cover"
            />
            {vehicle.imageCredit && (
              <span className="absolute bottom-1 right-2 text-[10px] text-white/70">
                {vehicle.imageCredit}
              </span>
            )}
          </div>

          {/* Vehicle Details */}
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-accent font-semibold mb-2">{vehicle.type}</p>
              <h1
                className="text-4xl lg:text-5xl font-bold text-foreground mb-4"
                data-testid="vehicle-name"
              >
                {vehicle.name}
              </h1>

              <p className="text-lg text-foreground/70 mb-8">
                {vehicle.description}
              </p>

              {/* Key Info */}
              <div className="grid grid-cols-2 gap-6 mb-8 py-8 border-y border-border">
                <div>
                  <p className="text-foreground/60 text-sm font-medium">
                    Pricing
                  </p>
                  <p className="text-xl font-bold text-accent">
                    ${vehicle.weekly}
                    <span className="text-sm text-foreground/60 font-medium">
                      {" "}
                      / week
                    </span>
                  </p>
                  <p className="text-xl font-bold text-accent">
                    ${vehicle.monthly}
                    <span className="text-sm text-foreground/60 font-medium">
                      {" "}
                      / month
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-foreground/60 text-sm font-medium">
                    Passengers
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="w-6 h-6 text-accent" />
                    <p className="text-2xl font-bold text-foreground">
                      {vehicle.seats}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plan Selector */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  Choose Your Plan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    data-testid="plan-option-weekly"
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                      plan === "weekly"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value="weekly"
                      checked={plan === "weekly"}
                      onChange={() => setPlan("weekly")}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">Weekly</span>
                      {plan === "weekly" && (
                        <span className="w-3 h-3 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-accent">
                      ${vehicle.weekly}
                    </p>
                    <p className="text-xs text-foreground/60">
                      Charged every week until canceled
                    </p>
                  </label>

                  <label
                    data-testid="plan-option-monthly"
                    className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                      plan === "monthly"
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value="monthly"
                      checked={plan === "monthly"}
                      onChange={() => setPlan("monthly")}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-foreground">Monthly</span>
                      {plan === "monthly" && (
                        <span className="w-3 h-3 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-accent">
                      ${vehicle.monthly}
                    </p>
                    <p className="text-xs text-foreground/60">
                      Charged every month until canceled
                    </p>
                  </label>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  Features
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {vehicle.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      <span className="text-foreground/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Book Button */}
            <Button
              onClick={handleBook}
              data-testid="book-this-car-btn"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg py-6"
            >
              Book This Car — ${selectedPrice}/{plan === "weekly" ? "week" : "month"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
