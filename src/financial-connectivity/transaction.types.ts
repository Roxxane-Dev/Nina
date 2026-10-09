export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum TransactionSource {
  MANUAL = 'manual',
  BANK_SYNC = 'bank_sync',
  OCR = 'ocr',
  SUNAT = 'sunat',
  CSV = 'csv',
}

export interface NormalizedTransaction {
  id: string;
  userId: string;
  merchant: {
    name: string;
    id?: string;
    category: string;
    subCategory?: string;
    logoUrl?: string;
  };
  amount: number;
  currency: string;
  timestamp: Date;
  source: TransactionSource;
  recurrenceType: RecurrenceType;
  confidence: number; // 0.0 to 1.0
  tags: string[];
  isSubscription: boolean;
  isIncome: boolean;
  metadata: Record<string, any>;
}
