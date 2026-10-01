import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Check,
  Shield,
  FileText,
  DollarSign,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  fetchMemberInvoices,
  fetchPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from '../services/billing.api';
import type { MemberInvoice, SavedPaymentMethod } from '../types';
import { AddPaymentMethodModal } from '../components/AddPaymentMethodModal';
import { InvoicePaymentModal } from '../components/InvoicePaymentModal';

export interface MemberBillingPageProps {
  chamberName?: string;
  onNavigateMembership?: () => void;
}

export const MemberBillingPage: React.FC<MemberBillingPageProps> = ({
  chamberName = '121 Meet.AI Chamber',
  onNavigateMembership,
}) => {
  const [invoices, setInvoices] = useState<MemberInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isAddCardOpen, setIsAddCardOpen] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<MemberInvoice | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);

  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [invData, cardsData] = await Promise.all([
        fetchMemberInvoices({ status: activeTab === 'all' ? undefined : activeTab }),
        fetchPaymentMethods(),
      ]);
      setInvoices(invData.invoices);
      setTotalOutstanding(invData.total_outstanding);
      setCurrency(invData.currency || 'USD');
      setPaymentMethods(cardsData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load billing records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [activeTab]);

  const handleMakeDefault = async (methodId: string) => {
    try {
      await setDefaultPaymentMethod(methodId);
      toast.success('Default payment card updated');
      const updated = await fetchPaymentMethods();
      setPaymentMethods(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update default card');
    }
  };

  const handleDeleteCard = async (methodId: string) => {
    try {
      await deletePaymentMethod(methodId);
      toast.success('Card removed from payment profiles');
      const updated = await fetchPaymentMethods();
      setPaymentMethods(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove card');
    }
  };

  const handlePayOutstandingBalance = () => {
    const earliestUnpaid = invoices.find((inv) => inv.status !== 'paid');
    if (earliestUnpaid) {
      setSelectedInvoiceToPay(earliestUnpaid);
      setIsPayModalOpen(true);
    } else {
      toast.info('No outstanding invoices found to pay');
    }
  };

  const getBrandGradient = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'linear-gradient(135deg, #1A1F71, #0B2447)';
      case 'mastercard':
        return 'linear-gradient(135deg, #EB001B, #F79E1B)';
      case 'amex':
        return 'linear-gradient(135deg, #007CC3, #002663)';
      case 'discover':
        return 'linear-gradient(135deg, #FF6000, #E65100)';
      default:
        return 'linear-gradient(135deg, #334155, #1E293B)';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing & Invoices</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your {chamberName} membership dues, event tickets, receipts, and payment profiles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBillingData()}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddCardOpen(true)}
            className="text-xs flex items-center gap-1.5 bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add Payment Method
          </Button>
        </div>
      </div>

      {/* 2. Outstanding Balance Hero Card */}
      <div
        className={`rounded-2xl p-6 sm:p-7 shadow-xs border transition-all ${
          totalOutstanding > 0
            ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 dark:bg-[#1E3352]/40 dark:border-amber-500/40'
            : 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:bg-[#1E3352]/40 dark:border-emerald-500/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                totalOutstanding > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
              }`}
            >
              {totalOutstanding > 0 ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    totalOutstanding > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {totalOutstanding > 0 ? 'Payment Outstanding' : 'Account in Good Standing'}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground mt-1 tracking-tight">
                ${totalOutstanding.toFixed(2)}{' '}
                <span className="text-sm font-semibold text-muted-foreground">{currency}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalOutstanding > 0
                  ? 'Total unpaid invoices currently due for your organization'
                  : 'All dues and event fees are settled. No action required.'}
              </p>
            </div>
          </div>

          {totalOutstanding > 0 && (
            <Button
              onClick={handlePayOutstandingBalance}
              className="w-full sm:w-auto bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> Pay Outstanding Balance
            </Button>
          )}
        </div>
      </div>

      {/* 3. Invoices Ledger Card */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Invoices & Statements</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              History of all membership dues, event tickets, and store purchases
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl self-start sm:self-auto">
            {(['all', 'unpaid', 'paid'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'unpaid' ? 'Open & Due' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List / Table */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-[#0B2447] dark:text-blue-400 animate-spin" />
            <p className="text-xs text-muted-foreground">Loading invoice ledger...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No invoices found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {activeTab === 'unpaid'
                ? 'Great news! You have no open or unpaid invoices at this time.'
                : 'There are no billing records matching your filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-semibold">
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Issue Date</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'paid';
                  const isUnpaid = inv.status === 'unpaid' || inv.status === 'open';
                  const isOverdue = inv.status === 'overdue';

                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        <div>
                          <span>{inv.description}</span>
                          <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground/80 px-1.5 py-0.5 rounded bg-muted">
                            {inv.invoice_type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {inv.created_at?.split('T')[0] || '—'}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{inv.due_date || '—'}</td>
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        ${inv.total_amount?.toFixed(2)} {inv.currency}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : isOverdue
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {isPaid ? (
                            <Check className="w-2.5 h-2.5" />
                          ) : (
                            <Clock className="w-2.5 h-2.5" />
                          )}
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {!isPaid && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvoiceToPay(inv);
                                setIsPayModalOpen(true);
                              }}
                              className="text-[11px] h-7 px-2.5 font-bold border-[#0B2447] text-[#0B2447] dark:border-blue-400 dark:text-blue-300"
                            >
                              Pay Now
                            </Button>
                          )}
                          <a
                            href={inv.pdf_url || `/api/v1/member/invoices/${inv.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground p-1 rounded-md"
                            title="Download Receipt"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Saved Payment Methods (Vaulted Cards) Card */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Saved Payment Profiles</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vaulted credit cards used for automated membership renewals and single-click checkout
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddCardOpen(true)}
            className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" /> Add New Card
          </Button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
            <CreditCard className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs font-semibold text-foreground">No payment cards saved yet</p>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Add a card to streamline invoice renewals and one-click ticket purchases.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddCardOpen(true)}
              className="mt-2 text-xs"
            >
              Add First Card
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="rounded-2xl p-5 text-white flex flex-col justify-between shadow-sm relative overflow-hidden h-44"
                style={{ background: getBrandGradient(pm.brand) }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-extrabold tracking-widest uppercase opacity-90">
                      {pm.brand}
                    </p>
                    <p className="text-[10px] text-white/70">Payment Profile</p>
                  </div>
                  {pm.is_default && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 border border-white/30 text-white">
                      Default
                    </span>
                  )}
                </div>

                <div>
                  <p className="font-mono text-base tracking-widest font-bold">
                    •••• •••• •••• {pm.last_four}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-white/80 mt-1">
                    <span>EXPIRES</span>
                    <span className="font-mono">
                      {pm.expiry_month.toString().padStart(2, '0')}/{pm.expiry_year}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs">
                  {!pm.is_default ? (
                    <button
                      onClick={() => handleMakeDefault(pm.id)}
                      className="text-[11px] font-semibold text-white/90 hover:text-white underline underline-offset-2"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-[11px] text-white/70 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active Default
                    </span>
                  )}

                  <button
                    onClick={() => handleDeleteCard(pm.id)}
                    title="Remove card"
                    className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPaymentMethodModal
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        onSuccess={() => loadBillingData()}
      />

      <InvoicePaymentModal
        isOpen={isPayModalOpen}
        onClose={() => {
          setIsPayModalOpen(false);
          setSelectedInvoiceToPay(null);
        }}
        invoice={selectedInvoiceToPay}
        savedCards={paymentMethods}
        onSuccess={() => loadBillingData()}
      />
    </div>
  );
};
