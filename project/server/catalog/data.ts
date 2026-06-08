/**
 * Canonical car catalogue data model + seed data.
 *
 * The server is the single source of truth for car listings and pricing.
 * These seed values are used the first time the app runs (before an admin has
 * saved any edits) and as the fallback if the persistence layer is unavailable.
 *
 * Admin edits are persisted by server/catalog/store.ts and, once saved, take
 * precedence over these seeds.
 */

export interface Car {
  /** Stable identifier used in URLs (/vehicle/:id) and Stripe metadata. */
  id: string;
  name: string;
  type: string; // e.g. Sedan, Coupe, SUV
  weekly: number; // dollars, charged every week
  monthly: number; // dollars, charged every month
  seats: number;
  image: string; // absolute URL or /public path
  imageCredit?: string;
  description: string;
  features: string[];
}

export const SEED_CARS: Car[] = [
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

/** Deep clone the seed so callers can't accidentally mutate the module copy. */
export function cloneSeed(): Car[] {
  return SEED_CARS.map((c) => ({ ...c, features: [...c.features] }));
}
