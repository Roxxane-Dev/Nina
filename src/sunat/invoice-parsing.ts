import { Injectable } from '@nestjs/common';

export interface InvoiceMetadata {
  ruc: string;
  merchantName: string;
  amount: number;
  taxAmount: number;
  date: Date;
}

@Injectable()
export class InvoiceParsingService {
  async parseInvoice(fileBase64: string): Promise<InvoiceMetadata> {
    // Stub for OCR/LLM parsing
    return {
      ruc: '20100012345',
      merchantName: 'TOTTUS',
      amount: 150.50,
      taxAmount: 27.09,
      date: new Date()
    };
  }
}
