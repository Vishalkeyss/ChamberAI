import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Globe, Sparkles, Plus, Loader2, AlertCircle, Phone } from 'lucide-react';
import { provisionChamber } from '../services/super-chambers.api';
import { isValidPhoneNumber, isValidEmail, normalizePhoneNumber } from '@/lib/validation';
import { EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER } from '@/lib/placeholders';

interface AddChamberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddChamberModal: React.FC<AddChamberModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [city, setCity] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [customDomain, setCustomDomain] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  };

  const autoSlug = slugify(name);
  const effectiveSlug = slugTouched ? slug : autoSlug;

  const resetForm = () => {
    setName('');
    setAdminName('');
    setCity('');
    setAdminEmail('');
    setAdminPhone('');
    setSlug('');
    setSlugTouched(false);
    setCustomDomain('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Chamber name is required.');
      return;
    }
    if (!adminName.trim()) {
      setErrorMessage('Admin contact name is required.');
      return;
    }
    if (!adminEmail.trim() || !isValidEmail(adminEmail.trim())) {
      setErrorMessage('A valid admin email is required to send the invite.');
      return;
    }
    if (adminPhone.trim() && !isValidPhoneNumber(adminPhone.trim())) {
      setErrorMessage('Please enter a valid USA phone number (+1 (555) 019-2834) or leave blank.');
      return;
    }

    try {
      setIsLoading(true);
      await provisionChamber({
        name: name.trim(),
        city: city.trim() || name.trim(),
        subdomain: effectiveSlug || 'chamber',
        custom_domain: customDomain.trim() ? customDomain.trim() : null,
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_phone: adminPhone.trim() ? normalizePhoneNumber(adminPhone.trim()) : null,
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to provision chamber. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}>
      <DialogContent
        className="sm:max-w-[960px] w-full max-w-[960px] max-h-[90vh] overflow-y-auto bg-card text-card-foreground border border-border shadow-2xl p-6 md:p-8 rounded-2xl scrollbar-thin"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="pb-3 pr-8">
          <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
            Add New Chamber
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Provision an isolated workspace with its own admin and member dashboard
          </DialogDescription>
        </div>

        {errorMessage && (
          <div className="p-3 mb-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card 1: Chamber Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Chamber Details</p>
                <p className="text-[11px] text-muted-foreground">
                  Fields marked with * are required to provision the workspace
                </p>
              </div>
            </div>

            {/* Chamber Name */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Chamber name*
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Round Rock Chamber of Commerce"
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                required
              />
            </div>

            {/* Admin Contact and City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Admin name*
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Round Rock"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                />
              </div>
            </div>

            {/* Admin Email & Admin Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Admin email*
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={EMAIL_PLACEHOLDER}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Admin phone (optional)
                </label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder={PHONE_PLACEHOLDER}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Chamber Domain */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Chamber Domain</span>
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Platform subdomain (auto-generated)
              </label>
              <div className="flex items-center rounded-lg overflow-hidden border border-input bg-background">
                <input
                  type="text"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                  }}
                  className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-foreground"
                />
                <span className="px-3 py-2 text-sm shrink-0 bg-muted text-muted-foreground border-l border-input">
                  .chamber1to1meet.ai
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                The chamber will be live at <strong className="font-semibold text-foreground">{effectiveSlug || 'chamber'}.chamber1to1meet.ai</strong> immediately after provisioning.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Custom domain (optional)
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="e.g. roundrockchamber.org"
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                If provided, the admin will see DNS instructions to point this domain to their subdomain from Settings — Domain.
              </p>
            </div>
          </div>

          {/* Card 3: What happens next */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span>What happens next</span>
            </p>

            <ol className="m-0 p-0 list-none space-y-2.5">
              <li className="flex items-start gap-3 pb-2.5 border-b border-border">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  A new, fully isolated chamber workspace is created at its own subdomain.
                </div>
              </li>

              <li className="flex items-start gap-3 pb-2.5 border-b border-border">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  An invite with a setup link is sent to the admin's email (simulated in this demo).
                </div>
              </li>

              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Chamber appears in the Chambers list as "Pending Setup" until the admin completes the Onboarding Wizard.
                </div>
              </li>
            </ol>
          </div>

          {/* Full-width Provision Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm flex items-center justify-center gap-1.5 shadow-xs transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Provisioning Chamber...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Provision Chamber</span>
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

