export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  serviceChargePct: number;
  isActive: boolean;
};
export type Category = {
  nameKk?: string | null;
  nameEn?: string | null;
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};
export type MenuItem = {
  nameKk?: string | null;
  nameEn?: string | null;
  descriptionKk?: string | null;
  descriptionEn?: string | null;
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  costPrice?: number | null;
  isAvailable: boolean;
};
export type Participant = {
  id: string;
  guestUuid: string;
  displayName: string;
  isHost: boolean;
};
export type CartItem = {
  id: string;
  participantId: string;
  menuItemId: string;
  batchId: string | null;
  quantity: number;
  unitPrice: number;
};
export type Batch = {
  id: string;
  batchNumber: number;
  status: "PENDING" | "COOKING" | "SERVED" | "CANCELLED";
  createdAt: string;
};
export type Bucket = {
  id: string;
  restaurantId: string;
  tableId: string;
  hostGuestId: string;
  status: "OPEN" | "PAYMENT_REQUESTED" | "CLOSED";
  paymentMode: "TOGETHER" | "SEPARATE" | null;
  tableNumber: number;
  participants: Participant[];
  items: CartItem[];
  batches: Batch[];
};
export type Catalog = {
  restaurant: Restaurant;
  categories: Category[];
  menu: MenuItem[];
  tables: { id: string; number: number }[];
};
export type Account = {
  id: string;
  restaurantId: string | null;
  name: string;
  email: string;
  role: "CONTROLLER" | "ADMIN" | "STAFF";
};
export type Workspace = {
  user: { id: string; name: string; role: string; restaurantId: string | null };
  restaurants: Restaurant[];
  catalogs: Catalog[];
  buckets: Bucket[];
  analytics: Analytics;
  accounts: Account[];
  integrationRequests: {
    id: string;
    restaurantName: string;
    contactName: string;
    email: string;
    phone: string | null;
    city: string;
    tableCount: number | null;
    notes: string | null;
    status: string;
    createdAt: string;
  }[];
};
export type Analytics = {
  revenue: number;
  orders: number;
  avgParty: number;
  avgSpend: number;
  together: number;
  separate: number;
  active: number;
  products: {
    id: string;
    name: string;
    ordered: number;
    removed: number;
    hostRemoved: number;
    revenue: number;
    cost: number;
    currency: string;
  }[];
  hours: { day: number; hour: number; count: number }[];
};
export function money(amount: number, currency = "KZT") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
export function bill(bucket: Bucket, servicePct: number) {
  const valid = bucket.items.filter(
    (i) =>
      i.batchId &&
      bucket.batches.some(
        (b) => b.id === i.batchId && b.status !== "CANCELLED",
      ),
  );
  const subtotal = valid.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const service = Math.round((subtotal * servicePct) / 100);
  const shares = bucket.participants.map((p) => {
    const amount = valid
      .filter((i) => i.participantId === p.id)
      .reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const exact = subtotal ? (service * amount) / subtotal : 0;
    return {
      ...p,
      subtotal: amount,
      service: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  const left = service - shares.reduce((sum, p) => sum + p.service, 0);
  const ranked = shares
    .filter((p) => p.subtotal > 0)
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < left; i++) ranked[i % ranked.length].service++;
  const people = shares.map((p) => ({ ...p, total: p.subtotal + p.service }));
  return { subtotal, service, total: subtotal + service, people };
}
