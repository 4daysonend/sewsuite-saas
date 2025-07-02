export enum PeriodType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

// Convert string to enum
export function toPeriodType(period: string): PeriodType {
  switch (period.toLowerCase()) {
    case 'daily':
      return PeriodType.DAILY;
    case 'weekly':
      return PeriodType.WEEKLY;
    case 'monthly':
      return PeriodType.MONTHLY;
    default:
      throw new Error(`Invalid period: ${period}`);
  }
}

// Convert enum to string
export function fromPeriodType(period: PeriodType): string {
  return period.toLowerCase();
}
