import { Injectable } from '@nestjs/common';

export interface NormalizedBankAccount {
  id: string;
  provider: 'belvo' | 'prometeo' | 'manual';
  accountType: string;
  balance: number;
  currency: string;
}

export interface NormalizedBankTransaction {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  category: string;
  date: Date;
}

@Injectable()
export class BankingAdapterService {
  // Preparation layer for future integrations
}
