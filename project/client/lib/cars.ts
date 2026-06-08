/**
 * Client-side access to the car catalogue.
 *
 * The server (server/catalog) is the single source of truth. The frontend
 * fetches the live catalogue from /api/cars so admin edits show up immediately.
 * FALLBACK_CARS mirrors the server seed and is used only if the API is
 * unreachable (e.g. first paint before the request resolves, or an outage), so
 * the site always renders something sensible.
 */

export interface Car {
  id: string;
  name: string;
  type: string;
  weekly: number;
  monthly: number;
  seats: number;
  image: string;
  imageCredit?: string;
  description: string;
  features: string[];
}

export const FALLBACK_CARS: Car[] = [
  {
    id: "1",
    name: "Chrysler 200",
    type: "Sedan",
    weekly: 349,
    monthly: 1199,
    seats: 5,
    image: "/cars/chrysler-200.jpg",
    imageCredit: "Photo: Kevauto / Wikimedia Commons / CC BY-SA 4.0",
    description:
      "Smooth, stylish, and easy on gas. The Chrysler 200 is a comfortable sedan that's perfect for daily driving and weekend trips.",
    features: [
      "Backup Camera",
      "Bluetooth Connectivity",
      "Climate Control",
      "Touchscreen Display",
      "Cruise Control",
      "Power Windows",
    ],
  },
  {
    id: "2",
    name: "Chevy Camaro",
    type: "Coupe",
    weekly: 399,
    monthly: 1349,
    seats: 4,
    image:
      "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
    description:
      "Iconic American muscle. The Chevy Camaro delivers serious performance and head-turning style on every drive.",
    features: [
      "Sport Mode",
      "Backup Camera",
      "Bluetooth Connectivity",
      "Premium Sound",
      "Leather Seats",
      "Apple CarPlay/Android Auto",
    ],
  },
  {
    id: "3",
    name: "Chevy Tahoe",
    type: "SUV",
    weekly: 479,
    monthly: 1599,
    seats: 8,
    image: "/cars/tahoe.jpg",
    description:
      "A spacious and comfortable SUV perfect for families and group trips. The Chevy Tahoe offers excellent performance and luxury amenities.",
    features: [
      "All-Wheel Drive",
      "Cruise Control",
      "Backup Camera",
      "Bluetooth Connectivity",
      "Climate Control",
      "Leather Seats",
    ],
  },
];

/** Fetch the live catalogue, falling back to seed data on any error. */
export async function fetchCars(): Promise<Car[]> {
  try {
    const res = await fetch("/api/cars");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Car[];
    if (Array.isArray(data) && data.length > 0) return data;
    return FALLBACK_CARS;
  } catch {
    return FALLBACK_CARS;
  }
}
