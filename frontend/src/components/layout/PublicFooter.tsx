import React from 'react';
import { publicNavigation } from '@/core/navigation/public-navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { EMAIL_PLACEHOLDER } from '@/lib/placeholders';

export interface PublicFooterProps {
  chamberName?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  chamberName = 'Greater Metro Chamber of Commerce',
  address = '100 Downtown Plaza, Suite 400, Metro City, MC 10001',
  phone = '+1 (555) 019-2831',
  email = 'info@metrochamber.org',
}) => {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                {chamberName.charAt(0)}
              </div>
              <span className="font-bold text-base tracking-tight">{chamberName}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empowering local business growth, driving regional commerce, and creating vibrant community connections since 1924.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{email}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground">Explore</h4>
            <ul className="space-y-2 text-sm">
              {publicNavigation.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <a href={item.href} className="text-muted-foreground hover:text-primary transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Member Services */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground">Members</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/portal/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Member Portal Login
                </a>
              </li>
              <li>
                <a href="/join" className="text-muted-foreground hover:text-primary transition-colors">
                  Membership Benefits
                </a>
              </li>
              <li>
                <a href="/store" className="text-muted-foreground hover:text-primary transition-colors">
                  Chamber Store
                </a>
              </li>
              <li>
                <a href="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  Contact Support
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter Subscribe */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold tracking-wider uppercase text-foreground">Weekly Digest</h4>
            <p className="text-sm text-muted-foreground">
              Get upcoming community networking events and commerce opportunities in your inbox.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
              <Input
                type="email"
                placeholder={EMAIL_PLACEHOLDER}
                className="bg-background text-sm"
              />
              <Button type="submit" size="sm" className="w-full gap-2">
                <span>Subscribe</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} {chamberName}. Powered by 121Meet Chamber Engine.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:underline">Terms of Service</a>
            <a href="/accessibility" className="hover:underline">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
