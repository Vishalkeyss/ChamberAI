export interface MemberInvoice {
  id: string;
  invoice_number: string;
  invoice_type: 'membership' | 'event' | 'store' | 'sponsorship' | 'custom' | 'donation';
  description: string;
  amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: 'paid' | 'unpaid' | 'overdue' | 'refund_requested' | 'refunded' | 'cancelled';
  due_date: string;
  paid_at: string | null;
  payment_method_id: string | null;
  payment_gateway_txn_id: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface SavedPaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'upi';
  brand: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  created_at: string;
}

export interface BenefitUsageItem {
  benefit_key: string;
  benefit_name: string;
  usage_count: number;
  quota_limit: number;
  remaining: number;
  cycle_start: string;
  cycle_end: string;
}

export interface PayInvoiceInput {
  payment_method_id?: string | null;
  gateway_token?: string | null;
  card_details?: {
    brand?: string;
    number?: string;
    last_four?: string;
    expiry_month?: number;
    expiry_year?: number;
    save_card?: boolean;
  } | null;
}

export interface AddPaymentMethodInput {
  type?: 'card' | 'bank_account' | 'upi';
  brand: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default?: boolean;
  gateway_token_encrypted?: string;
}
