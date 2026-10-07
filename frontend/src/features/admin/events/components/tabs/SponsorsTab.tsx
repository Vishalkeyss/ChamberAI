import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Plus, Loader2 } from 'lucide-react';
import type { EventSponsorItem } from '../../services/admin-events.api';
import { fetchAdminEventSponsors } from '../../services/admin-events.api';

interface SponsorsTabProps {
  eventId: string;
  chamberSlug?: string;
}

export const SponsorsTab: React.FC<SponsorsTabProps> = ({ eventId, chamberSlug }) => {
  const [sponsors, setSponsors] = useState<EventSponsorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchAdminEventSponsors(eventId, chamberSlug)
      .then((data) => {
        if (mounted) setSponsors(data);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [eventId, chamberSlug]);

  const totalSponsorshipRevenue = sponsors.reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Event Sponsors & Partners</h3>
          <p className="text-xs text-muted-foreground">
            Total Sponsor Commitments: ${totalSponsorshipRevenue.toLocaleString()}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Sponsor
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Loading sponsors...
            </div>
          ) : sponsors.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Award className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">No Event Sponsors Yet</p>
              <p className="text-xs mt-1">
                Packages configured in Sponsor Setup can be booked by members or assigned manually.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Sponsor</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Payment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sponsors.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{s.sponsorName}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {s.tierName || 'Sponsor'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        ${s.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={s.status === 'paid' ? 'default' : 'secondary'}
                          className="text-[10px] py-0 px-1.5 capitalize"
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
