import { buildChamberHost } from '@/core/config/app-config';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Globe, Building2, ShieldAlert, ShieldCheck, MoreHorizontal, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddChamberModal } from '../components/AddChamberModal';
import { ChamberDetailModal } from '../components/ChamberDetailModal';
import { fetchSuperChambers, updateChamberStatus } from '../services/super-chambers.api';
import { getChamberSetupProgress } from '../utils/setup-progress';
import type { PlatformChamber } from '../types';

export const SuperChambersPage: React.FC = () => {
  const [chambers, setChambers] = useState<PlatformChamber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailChamber, setDetailChamber] = useState<PlatformChamber | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadChambers = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await fetchSuperChambers();
      // Live data only — an empty platform shows the empty state (no demo rows).
      setChambers(res?.data ?? []);
    } catch (err) {
      console.error('Could not load chambers:', err);
      setChambers([]);
      setLoadError(err instanceof Error ? err.message : 'Could not load chambers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChambers();
  }, []);

  const handleToggleStatus = async (chamber: PlatformChamber) => {
    const nextStatus = chamber.status === 'suspended' ? 'active' : 'suspended';
    try {
      setUpdatingId(chamber.id);
      await updateChamberStatus(chamber.id, {
        status: nextStatus,
        reason: `Super Admin status switch to ${nextStatus}`,
      });
      // Update local state immediately
      setChambers((prev) =>
        prev.map((c) => (c.id === chamber.id ? { ...c, status: nextStatus } : c))
      );
    } catch (err: any) {
      alert(`Failed to update chamber status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredChambers = useMemo(() => {
    if (!searchQuery.trim()) return chambers;
    const q = searchQuery.toLowerCase().trim();
    return chambers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        c.subdomain.toLowerCase().includes(q) ||
        (c.customDomain && c.customDomain.toLowerCase().includes(q)) ||
        (c.adminContactName && c.adminContactName.toLowerCase().includes(q)) ||
        (c.adminEmail && c.adminEmail.toLowerCase().includes(q))
    );
  }, [chambers, searchQuery]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };


  return (
    <div className="space-y-6">
      {/* Top Action Bar matching Screenshot */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chambers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 text-sm bg-card border-border rounded-xl shadow-2xs placeholder:text-muted-foreground text-foreground"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-sm shadow-xs flex items-center gap-2 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Chamber</span>
          </Button>
        </div>
      </div>

      {/* Chambers Table Card matching Screenshot */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-sm font-semibold text-muted-foreground bg-muted/30">
                <th className="py-4 px-6">Chamber</th>
                <th className="py-4 px-6">Domain</th>
                <th className="py-4 px-6">Admin Name</th>
                <th className="py-4 px-6">Members</th>
                <th className="py-4 px-6">Revenue</th>
                <th className="py-4 px-6">Setup</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && chambers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading chambers directory...</span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-destructive/70" />
                    <p className="font-medium text-foreground">Couldn't load chambers</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={loadChambers}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : chambers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No chambers yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Provision the first chamber tenant to get started.
                    </p>
                    <Button size="sm" className="mt-3" onClick={() => setIsAddModalOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Chamber
                    </Button>
                  </td>
                </tr>
              ) : filteredChambers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">No chambers found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try searching with a different keyword or provision a new chamber tenant.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredChambers.map((chamber) => {
                  const isSuspended = chamber.status === 'suspended';
                  const isPending = chamber.status === 'pending_setup';

                  // Calculate setup progress dynamically from real D1 data
                  const setupProgress = getChamberSetupProgress(chamber);
                  const setupPct = setupProgress.percent;
                  const setupDotColor =
                    setupPct >= 80 ? 'bg-emerald-500' : setupPct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

                  const displayDomain = buildChamberHost(chamber) || chamber.subdomain;
                  const domainSubtitle = chamber.customDomain
                    ? (chamber.domainStatus === 'verified' ? 'Verified' : 'Pending DNS')
                    : null;

                  return (
                    <tr
                      key={chamber.id}
                      onClick={() => {
                        setDetailChamber(chamber);
                        setIsDetailModalOpen(true);
                      }}
                      title="Click to view chamber details"
                      className="hover:bg-muted/50 transition-colors duration-150 cursor-pointer"
                    >
                      {/* Chamber Name */}
                      <td className="py-5 px-6">
                        <div className="font-medium text-foreground text-sm max-w-[200px] leading-snug">
                          {chamber.name}
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{displayDomain}</span>
                        </div>
                        {domainSubtitle && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 pl-5">
                            {domainSubtitle}
                          </div>
                        )}
                      </td>

                      {/* Admin Name */}
                      <td className="py-5 px-6 text-sm text-muted-foreground">
                        {chamber.adminContactName || 'Alexander Morgan'}
                      </td>

                      {/* Members */}
                      <td className="py-5 px-6 text-sm font-medium text-foreground">
                        {chamber.membersCount.toLocaleString()}
                      </td>

                      {/* Revenue */}
                      <td className="py-5 px-6 text-sm font-semibold text-foreground">
                        {formatCurrency(chamber.revenueTotal)}
                      </td>

                      {/* Setup */}
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className={`h-2 w-2 rounded-full ${setupDotColor} shrink-0`} />
                          <span>{setupPct}%</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-5 px-6">
                        {isSuspended ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                            Suspended
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Pending Setup
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Chamber Modal */}
      <AddChamberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadChambers();
        }}
      />

      {/* Chamber Detail Modal matching reference screenshot */}
      <ChamberDetailModal
        chamber={detailChamber}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onVerifyDomain={(c) => {
          setChambers((prev) =>
            prev.map((item) => (item.id === c.id ? { ...item, domainStatus: 'verified' } : item))
          );
          if (detailChamber && detailChamber.id === c.id) {
            setDetailChamber({ ...detailChamber, domainStatus: 'verified' });
          }
        }}
      />
    </div>
  );
};
