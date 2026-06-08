import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Car, FileText, CheckCircle } from "lucide-react";
import { fetchCars, FALLBACK_CARS } from "@/lib/cars";

export default function Index() {
  // Live catalogue from the server (single source of truth). placeholderData
  // shows seed cars instantly for fast first paint / API outages, but (unlike
  // initialData) still fetches the real catalogue so admin edits show up.
  const { data: cars = FALLBACK_CARS } = useQuery({
    queryKey: ["cars"],
    queryFn: fetchCars,
    placeholderData: FALLBACK_CARS,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[500px]">
          {/* Left side - Text content */}
          <div className="flex flex-col justify-center px-6 sm:px-12 py-12 lg:py-0 bg-white">
            <h1 className="text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
              Drive a Car Weekly.
              <br />
              Simple & Affordable.
            </h1>
            <p className="text-lg text-foreground/70 mb-8 font-medium">
              Flexible rentals. No long-term commitment.
            </p>
            <div className="flex gap-4">
              <Link to="/">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base px-8 py-3">
                  Browse Cars
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side - Hero image */}
          <div className="relative hidden lg:block bg-gray-100">
            <img
              src="/cars/tahoe.jpg"
              alt="Chevy Tahoe SUV"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              How it Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                <Car className="w-10 h-10 text-accent" />
              </div>
              <div className="text-2xl font-bold text-accent mb-2">1</div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                Choose Your Car
              </h3>
              <p className="text-foreground/70">
                Select from our available vehicles.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-accent" />
              </div>
              <div className="text-2xl font-bold text-accent mb-2">2</div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                Get Approved
              </h3>
              <p className="text-foreground/70">
                Upload your license and basic details.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-accent" />
              </div>
              <div className="text-2xl font-bold text-accent mb-2">3</div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                Start Driving
              </h3>
              <p className="text-foreground/70">
                Sign and pay weekly. Hit the road!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Available Cars Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Available Cars
            </h2>
            <p className="text-lg text-foreground/70">Pick Your Ride</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cars.map((car) => (
              <div
                key={car.id}
                data-testid={`car-card-${car.id}`}
                className="bg-white border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-64 bg-gray-100">
                  <img
                    src={car.image}
                    alt={car.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-foreground mb-1">
                    {car.name}
                  </h3>
                  <p className="text-sm text-foreground/60 mb-4">{car.type}</p>

                  {/* Weekly + Monthly pricing */}
                  <div className="space-y-1 mb-6">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-2xl font-bold text-accent"
                        data-testid={`car-weekly-price-${car.id}`}
                      >
                        ${car.weekly}
                      </span>
                      <span className="text-foreground/60 text-sm">/week</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-2xl font-bold text-accent"
                        data-testid={`car-monthly-price-${car.id}`}
                      >
                        ${car.monthly}
                      </span>
                      <span className="text-foreground/60 text-sm">/month</span>
                    </div>
                  </div>

                  <Link to={`/vehicle/${car.id}`}>
                    <Button
                      data-testid={`car-view-details-${car.id}`}
                      className="w-full bg-foreground hover:bg-foreground/90 text-white"
                    >
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">CarNextDrive</h4>
              <p className="text-white/70 text-sm">
                Simple & affordable weekly car rentals.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center text-white/70 text-sm">
            <p>&copy; 2024 CarNextDrive. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
