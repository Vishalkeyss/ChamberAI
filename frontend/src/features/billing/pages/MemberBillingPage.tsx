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
  ShoppingBag,
  Landmark,
  CalendarDays,
  Tag,
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
import { AddBankAccountModal } from '../components/AddBankAccountModal';
import { InvoicePaymentModal } from '../components/InvoicePaymentModal';

export type BillingTab = 'profiles' | 'pay' | 'history' | 'cart';

export interface CartItem {
  id: string;
  desc: string;
  note: string;
  amount: number;
}

const DEFAULT_CART_ITEMS: CartItem[] = [
  {
    id: 'cart-1',
    desc: 'Annual Chamber Gala — VIP Networking Ticket',
    note: 'Event Registration · 1x Ticket',
    amount: 35.0,
  },
  {
    id: 'cart-2',
    desc: 'Featured Business Spotlight — Monthly Directory Badge',
    note: 'Marketplace Add-on · 30 Days',
    amount: 10.0,
  },
];

export interface MemberBillingPageProps {
  chamberName?: string;
  onNavigateMembership?: () => void;
}

export const MemberBillingPage: React.FC<MemberBillingPageProps> = ({
  chamberName = '121 Meet.AI Chamber',
  onNavigateMembership,
}) => {
  const [billingTab, setBillingTab] = useState<BillingTab>('profiles');
  const [invoices, setInvoices] = useState<MemberInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('USD');
  const [activeHistoryFilter, setActiveHistoryFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>(DEFAULT_CART_ITEMS);
  const [selectedCartIds, setSelectedCartIds] = useState<Set<string>>(
    () => new Set(DEFAULT_CART_ITEMS.map((item) => item.id))
  );

  // Modals state
  const [isAddCardOpen, setIsAddCardOpen] = useState<boolean>(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<MemberInvoice | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const loadBillingData = async () => {
    setIsLoading(true);
    try {
      const [invData, cardsData] = await Promise.all([
        fetchMemberInvoices({ status: activeHistoryFilter === 'all' ? undefined : activeHistoryFilter }),
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
  }, [activeHistoryFilter]);

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
      toast.success('Payment method removed');
      const updated = await fetchPaymentMethods();
      setPaymentMethods(updated);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove payment method');
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

  const handleDownloadInvoice = async (inv: MemberInvoice) => {
    try {
      const token = localStorage.getItem('auth_token');
      const downloadUrl = inv.pdf_url || `/api/v1/member/invoices/${encodeURIComponent(inv.id)}/download`;

      const res = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to download invoice receipt');
      }

      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      const printWin = window.open(blobUrl, '_blank');
      if (!printWin) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Invoice-${inv.invoice_number || inv.id}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download invoice receipt');
    }
  };

  const getBrandGradient = (brand: string, type?: string) => {
    if (type === 'bank_account') {
      return 'linear-gradient(135deg, #0B2447, #16385C)';
    }
    const b = (brand || '').toLowerCase();
    if (b.includes('visa')) {
      return 'linear-gradient(135deg, #1A62A5, #11A99C)'; // Blue-teal gradient matching reference screenshot
    }
    if (b.includes('master')) {
      return 'linear-gradient(135deg, #2D3748, #1A202C)'; // Dark charcoal slate matching reference screenshot
    }
    if (b.includes('rupay') || b.includes('rupee')) {
      return 'linear-gradient(135deg, #097939, #054C24)';
    }
    if (b.includes('amex')) {
      return 'linear-gradient(135deg, #2C5364, #0F2027)';
    }
    if (b.includes('discover')) {
      return 'linear-gradient(135deg, #F7971E, #FFD200)';
    }
    return 'linear-gradient(135deg, #2D3748, #1A202C)';
  };

  // Cart helpers
  const toggleCartItem = (id: string) => {
    setSelectedCartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllCart = () => {
    if (selectedCartIds.size === cartItems.length) {
      setSelectedCartIds(new Set());
    } else {
      setSelectedCartIds(new Set(cartItems.map((i) => i.id)));
    }
  };

  const removeCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedCartIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('Item removed from cart');
  };

  const selectedCartItems = cartItems.filter((i) => selectedCartIds.has(i.id));
  const cartSubtotal = selectedCartItems.reduce((acc, curr) => acc + curr.amount, 0);

  const handleCheckoutSelected = () => {
    if (selectedCartItems.length === 0) {
      toast.info('Please select at least one item to checkout');
      return;
    }
    toast.success(
      `Checkout successful for ${selectedCartItems.length} item${
        selectedCartItems.length > 1 ? 's' : ''
      } ($${cartSubtotal.toFixed(2)}) ✅`
    );
    setCartItems((prev) => prev.filter((item) => !selectedCartIds.has(item.id)));
    setSelectedCartIds(new Set());
  };

  const handlePayCartItemNow = (item: CartItem) => {
    toast.success(`Payment of $${item.amount.toFixed(2)} for ${item.desc} completed ✅`);
    removeCartItem(item.id);
  };

  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');

  const TABS = [
    { key: 'profiles', label: 'Payment Profiles', icon: CreditCard },
    { key: 'pay', label: 'Make a Payment', icon: CheckCircle2 },
    { key: 'history', label: 'Transaction History', icon: Download },
    { key: 'cart', label: 'Shopping Cart', icon: ShoppingBag, badge: cartItems.length },
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Top Navigation Tabs */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = billingTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setBillingTab(t.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-[#0B2447] text-white shadow-xs dark:bg-blue-600'
                  : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.key === 'cart' && cartItems.length > 0 && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {cartItems.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 2. TAB: PAYMENT PROFILES */}
      {billingTab === 'profiles' && (
        <div className="space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Payment Profiles</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Saved cards you can pay invoices with in one click
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                onClick={() => setIsAddCardOpen(true)}
                className="bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Card
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddBankOpen(true)}
                className="border-border bg-card hover:bg-muted text-foreground font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Bank Account
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#0B2447] dark:text-blue-400 animate-spin" />
              <p className="text-xs text-muted-foreground">Loading payment profiles...</p>
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center flex flex-col items-center justify-center gap-2">
              <CreditCard className="w-10 h-10 text-muted-foreground/40 mb-1" />
              <p className="text-sm font-semibold text-foreground">No payment profiles saved yet</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Add a credit card or bank account to streamline invoice renewals and single-click ticket purchases.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => setIsAddCardOpen(true)}
                  className="bg-[#0B2447] hover:bg-[#16385C] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddBankOpen(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Bank Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {paymentMethods.map((pm) => {
                const isBank = pm.type === 'bank_account';
                const cardNumberDisplay = `•••• •••• •••• ${pm.last_four}`;

                if (isBank) {
                  return (
                    <div
                      key={pm.id}
                      className="rounded-2xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[175px] transition-all"
                      style={{ background: getBrandGradient(pm.brand, pm.type) }}
                    >
                      {/* Decorative Background Circles */}
                      <div
                        className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none"
                        style={{ background: '#ffffff14' }}
                      />
                      <div
                        className="absolute -right-2 bottom-6 w-16 h-16 rounded-full pointer-events-none"
                        style={{ background: '#ffffff10' }}
                      />

                      <div className="relative flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 text-white/90">
                          <Landmark className="w-3.5 h-3.5" /> {pm.brand || 'Bank Account'}
                        </span>
                        {pm.is_default && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                            Default
                          </span>
                        )}
                      </div>

                      <p className="relative font-mono text-xl sm:text-2xl font-bold tracking-[0.16em] text-white my-3">
                        •••• •••• {pm.last_four || '1234'}
                      </p>

                      <div className="relative flex items-end justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/70">ACCOUNT</p>
                          <p className="text-sm font-semibold text-white">ACH Direct Debit</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!pm.is_default && (
                            <button
                              type="button"
                              onClick={() => handleMakeDefault(pm.id)}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                              title="Set as Default"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(pm.id)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                            title="Remove Bank Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={pm.id}
                    className="rounded-2xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[175px] transition-all"
                    style={{ background: getBrandGradient(pm.brand) }}
                  >
                    {/* Decorative Background Circles */}
                    <div
                      className="absolute -right-6 -top-6 w-28 h-28 rounded-full pointer-events-none"
                      style={{ background: '#ffffff14' }}
                    />
                    <div
                      className="absolute -right-2 bottom-6 w-16 h-16 rounded-full pointer-events-none"
                      style={{ background: '#ffffff10' }}
                    />

                    {/* Top Row: Brand & Default */}
                    <div className="relative flex items-center justify-between">
                      <span className="text-xs font-extrabold tracking-wider uppercase text-white">
                        {pm.brand || 'CARD'}
                      </span>
                      <div className="flex items-center gap-2">
                        {pm.is_default && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                            Default
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Number */}
                    <p className="relative font-mono text-xl sm:text-2xl font-bold tracking-[0.16em] text-white my-3">
                      {cardNumberDisplay}
                    </p>

                    {/* Bottom Row: Expiry / CVV & Actions */}
                    <div className="relative flex items-end justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/70">EXPIRES</p>
                        <p className="text-sm font-semibold text-white">
                          {pm.expiry_month.toString().padStart(2, '0')}/
                          {pm.expiry_year.toString().slice(-2)}
                        </p>                      </div>

                      <div className="flex items-center gap-1.5">
                        {!pm.is_default && (
                          <button
                            type="button"
                            onClick={() => handleMakeDefault(pm.id)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                            title="Make default"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(pm.id)}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                          title="Remove card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: MAKE A PAYMENT */}
      {billingTab === 'pay' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Make a Payment</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Outstanding invoices awaiting settlement
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBillingData()}
              className="text-xs flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {/* Outstanding Balance Hero Card */}
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
                  className="w-full sm:w-auto bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" /> Pay Outstanding Balance
                </Button>
              )}
            </div>
          </div>

          {/* Unpaid Invoices List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#0B2447] dark:text-blue-400 animate-spin" />
              <p className="text-xs text-muted-foreground">Checking open invoices...</p>
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-foreground">Nothing due</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                You're all caught up — no outstanding invoices at this time.
              </p>
            </div>
          ) : (
            <div className="bg-card text-card-foreground rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {unpaidInvoices.map((inv) => (
                <div key={inv.id} className="p-5 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">{inv.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {inv.invoice_number} · Due {inv.due_date ? inv.due_date.split('T')[0] : 'Upon receipt'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-foreground font-mono">
                      ${inv.total_amount?.toFixed(2)} {inv.currency}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedInvoiceToPay(inv);
                        setIsPayModalOpen(true);
                      }}
                      className="bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Pay {paymentMethods.some((pm) => pm.is_default) ? 'with saved card' : 'Now'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. TAB: TRANSACTION HISTORY */}
      {billingTab === 'history' && (
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-foreground">Transaction History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tax-compliant invoices and statements for every transaction
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl self-start sm:self-auto">
              {(['all', 'unpaid', 'paid'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveHistoryFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize cursor-pointer ${
                    activeHistoryFilter === tab
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
              <p className="text-xs text-muted-foreground">Loading transaction ledger...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
              <FileText className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No invoices found</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {activeHistoryFilter === 'unpaid'
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
                    <th className="py-3 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {invoices.map((inv) => {
                    const isPaid = inv.status === 'paid';
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
                          {inv.created_at
                            ? inv.created_at.includes('T')
                              ? inv.created_at.split('T')[0]
                              : inv.created_at.split(' ')[0]
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {inv.due_date
                            ? inv.due_date.includes('T')
                              ? inv.due_date.split('T')[0]
                              : inv.due_date.split(' ')[0]
                            : '—'}
                        </td>
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
                          <div className="inline-flex items-center justify-end gap-2">
                            {!isPaid && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedInvoiceToPay(inv);
                                  setIsPayModalOpen(true);
                                }}
                                className="text-[11px] h-7 px-2.5 font-bold border-[#0B2447] text-[#0B2447] dark:border-blue-400 dark:text-blue-300 cursor-pointer"
                              >
                                Pay Now
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(inv)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-foreground py-1 px-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                              title="Download Invoice"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Invoice</span>
                            </button>
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
      )}

      {/* 5. TAB: SHOPPING CART */}
      {billingTab === 'cart' && (
        <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Shopping Cart</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review items before checkout — pay for everything together, or one item at a time
            </p>
          </div>

          {cartItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-foreground">Your cart is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Items like event tickets, store purchases, or plan upgrades will appear here.
              </p>
            </div>
          ) : (
            <div>
              {/* Select All Row */}
              <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="cart-select-all"
                  checked={selectedCartIds.size === cartItems.length && cartItems.length > 0}
                  onChange={toggleAllCart}
                  className="rounded text-blue-600 cursor-pointer"
                />
                <label
                  htmlFor="cart-select-all"
                  className="text-xs font-semibold text-muted-foreground cursor-pointer select-none"
                >
                  {selectedCartIds.size === cartItems.length ? 'Deselect all' : 'Select all'}
                </label>
              </div>

              {/* Items List */}
              <div className="divide-y divide-border">
                {cartItems.map((item) => {
                  const isChecked = selectedCartIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="p-5 flex items-center justify-between gap-4 flex-wrap hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCartItem(item.id)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center text-[#0B2447] dark:text-blue-400 shrink-0">
                          {item.note.toLowerCase().includes('event') ? (
                            <CalendarDays className="w-5 h-5" />
                          ) : (
                            <Tag className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{item.desc}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold text-foreground font-mono">
                          ${item.amount.toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePayCartItemNow(item)}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          Pay Now
                        </Button>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cart Footer Summary */}
              <div className="p-5 bg-muted/30 border-t border-border flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total ({selectedCartItems.length} of {cartItems.length} item
                    {cartItems.length > 1 ? 's' : ''} selected)
                  </p>
                  <p className="text-xl font-extrabold text-foreground font-mono mt-0.5">
                    ${cartSubtotal.toFixed(2)}
                  </p>
                </div>
                <Button
                  onClick={handleCheckoutSelected}
                  disabled={selectedCartItems.length === 0}
                  className="bg-[#0B2447] hover:bg-[#16385C] text-white dark:bg-blue-600 dark:hover:bg-blue-500 font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" /> Checkout Selected
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddPaymentMethodModal
        isOpen={isAddCardOpen}
        onClose={() => setIsAddCardOpen(false)}
        onSuccess={() => loadBillingData()}
      />

      <AddBankAccountModal
        isOpen={isAddBankOpen}
        onClose={() => setIsAddBankOpen(false)}
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
