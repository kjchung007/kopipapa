export const orderStatuses = [
  "draft",
  "pending_payment",
  "payment_failed",
  "paid",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const orderTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ["pending_payment"],
  pending_payment: ["paid", "payment_failed"],
  payment_failed: [],
  paid: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return orderTransitions[from].includes(to);
}

export function formatMoney(amountMinor: number, currency = "SGD", locale = "en-SG"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMinor / 100);
}
