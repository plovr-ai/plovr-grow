export const CHURN_RATE = 0.25;
export const ORDERS_PER_CUSTOMER = 2;

export interface CustomerLossResult {
  estimatedCustomers: number;
  lostCustomers: number;
  monthlyRevenueLoss: number;
  yearlyRevenueLoss: number;
}

export function calculateCustomerLoss(
  monthlyOrders: number,
  aov: number
): CustomerLossResult {
  const estimatedCustomers = Math.round(monthlyOrders / ORDERS_PER_CUSTOMER);
  const lostCustomers = Math.round(estimatedCustomers * CHURN_RATE);
  const monthlyRevenueLoss = lostCustomers * aov * ORDERS_PER_CUSTOMER;
  const yearlyRevenueLoss = monthlyRevenueLoss * 12;
  return { estimatedCustomers, lostCustomers, monthlyRevenueLoss, yearlyRevenueLoss };
}
