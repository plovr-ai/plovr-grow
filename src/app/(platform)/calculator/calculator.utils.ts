export const PLATFORM_FEES = {
  doordash: { commissionRate: 0.25, marketingFee: 0.03 },
  ubereats: { commissionRate: 0.28, marketingFee: 0.03 },
  both: { commissionRate: 0.265, marketingFee: 0.03 },
} as const;

export type Platform = keyof typeof PLATFORM_FEES;

export function calculateMonthlyLoss(
  revenue: number,
  platform: Platform
): number {
  const { commissionRate, marketingFee } = PLATFORM_FEES[platform];
  const loss = revenue * (commissionRate + marketingFee);
  return Math.round(loss * 100) / 100;
}

export function calculateYearlyLoss(monthlyLoss: number): number {
  return Math.round(monthlyLoss * 12 * 100) / 100;
}
