import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Image as ImageIcon,
  UploadCloud,
  X,
  MapPin,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Loader2,
  Building2,
  Search,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  deleteBusinessLogo,
  searchRelatedOrganizations,
  type BusinessProfileData,
  type RelatedOrganization,
  type RelatedOrgSearchResult,
} from '../services/business-profile.api';

const RELATIONSHIP_TYPES: Array<RelatedOrganization['relationshipType']> = [
  'Parent Company',
  'Branch Office',
  'Sister Company',
  'Subsidiary',
  'Affiliate',
];

const RECIPROCAL_MAP: Record<RelatedOrganization['relationshipType'], string> = {
  'Parent Company': 'Subsidiary',
  'Subsidiary': 'Parent Company',
  'Branch Office': 'Headquarters / Parent',
  'Sister Company': 'Sister Company',
  'Affiliate': 'Affiliate',
};

export interface EditBusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CHAMBER_INDUSTRY_OPTIONS = [
  'Manufacturing',
  'Textiles',
  'IT Services',
  'FMCG',
  'Automotive',
  'Interior Design',
  'Retail',
  'Logistics',
  'Legal',
  'Marketing',
  'Finance',
  'Electricals',
  'Handicrafts',
  'Consulting',
  'Design',
  'Other',
];

function normalizeUrl(u: string): string {
  const v = (u || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export const EditBusinessProfileModal: React.FC<EditBusinessProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [landingPage, setLandingPage] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Social Links
  const [socials, setSocials] = useState<{
    facebook: string;
    instagram: string;
    linkedin: string;
    twitter: string;
    youtube: string;
  }>({
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    youtube: '',
  });

  // Address & Locations
  const [street, setStreet] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');

  // Categories & Details
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [relatedOrganizations, setRelatedOrganizations] = useState<RelatedOrganization[]>([]);
  const [description, setDescription] = useState('');

  // Related Organizations Inline Search State
  const [relSearchQuery, setRelSearchQuery] = useState('');
  const [relSearchResults, setRelSearchResults] = useState<RelatedOrgSearchResult[]>([]);
  const [isLoadingRelSearch, setIsLoadingRelSearch] = useState(false);
  const [pickedOrg, setPickedOrg] = useState<RelatedOrgSearchResult | null>(null);
  const [relType, setRelType] =
    useState<RelatedOrganization['relationshipType']>('Parent Company');
  const [isRelDropdownOpen, setIsRelDropdownOpen] = useState(false);
  const relContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Business Profile Data when opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadProfile() {
      try {
        setIsLoading(true);
        const data: BusinessProfileData = await fetchBusinessProfile();
        if (!isMounted) return;

        setBusinessName(data.name || '');
        setTagline(data.tagline || '');
        setPhone(data.businessPhone || '');
        setEmail(data.businessEmail || '');
        setWebsite(data.website || '');
        setLogoUrl(data.logoUrl || null);
        setDescription(data.description || '');
        setStreet(data.streetAddress || '');
        setState(data.state || '');
        setZip(data.zip || '');

        // Locations
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
        } else if (data.city) {
          setLocations([data.city]);
        } else {
          setLocations([]);
        }

        // Industry Categories
        if (data.industry) {
          const cats = data.industry
            .split(/[,|]/)
            .map((c) => c.trim())
            .filter(Boolean);
          setSelectedCategories(cats.length > 0 ? cats : [data.industry]);
        } else {
          setSelectedCategories([]);
        }

        // Social Links
        const rawSocials = (data.socialLinks as any) || {};
        setSocials({
          facebook: rawSocials.facebook || '',
          instagram: rawSocials.instagram || '',
          linkedin: rawSocials.linkedin || '',
          twitter: rawSocials.twitter || rawSocials['x'] || '',
          youtube: rawSocials.youtube || rawSocials.other || '',
        });

        if (rawSocials.landingPage) {
          setLandingPage(rawSocials.landingPage);
        }

        // Related Organizations
        setRelatedOrganizations(data.relatedOrganizations || []);
      } catch (err: any) {
        console.error('Failed to load profile for edit modal', err);
        toast.error(err.message || 'Could not load business profile');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle Logo Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be less than 5MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const res = await uploadBusinessLogo(file);
      setLogoUrl(res.logoUrl);
      window.dispatchEvent(
        new CustomEvent('business-logo:updated', { detail: { logoUrl: res.logoUrl } })
      );
      toast.success('Logo updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUrl(null);
    window.dispatchEvent(
      new CustomEvent('business-logo:updated', { detail: { logoUrl: null } })
    );
    try {
      await deleteBusinessLogo();
      toast.success('Logo removed');
    } catch (err: any) {
      console.warn('Backend logo deletion warning:', err);
    }
  };

  // Location Tags Input Logic
  const commitLocationInput = () => {
    const val = locationInput.trim();
    if (!val) return;
    const exists = locations.some((l) => l.toLowerCase() === val.toLowerCase());
    if (!exists) {
      setLocations((prev) => [...prev, val]);
    }
    setLocationInput('');
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitLocationInput();
    } else if (e.key === 'Backspace' && !locationInput && locations.length > 0) {
      setLocations((prev) => prev.slice(0, -1));
    }
  };

  const removeLocation = (indexToRemove: number) => {
    setLocations((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Category Toggle Logic
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Debounced search query against chamber network
  useEffect(() => {
    if (!relSearchQuery.trim() || relSearchQuery.length < 2 || pickedOrg) {
      setRelSearchResults([]);
      setIsRelDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoadingRelSearch(true);
        const results = await searchRelatedOrganizations(relSearchQuery.trim());
        const filtered = results.filter(
          (r) =>
            !relatedOrganizations.some(
              (org) =>
                org.businessId === r.id ||
                org.businessName.toLowerCase() === r.name.toLowerCase()
            )
        );
        setRelSearchResults(filtered);
        setIsRelDropdownOpen(true);
      } catch (err) {
        console.error('Failed to search organizations', err);
        setRelSearchResults([]);
      } finally {
        setIsLoadingRelSearch(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [relSearchQuery, relatedOrganizations, pickedOrg]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (relContainerRef.current && !relContainerRef.current.contains(event.target as Node)) {
        setIsRelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddRelatedOrg = () => {
    if (!pickedOrg) return;
    const reciprocal = RECIPROCAL_MAP[relType];
    const newEntry: RelatedOrganization = {
      businessId: pickedOrg.id,
      businessName: pickedOrg.name,
      relationshipType: relType,
      reciprocalType: reciprocal,
    };
    setRelatedOrganizations((prev) => [...prev, newEntry]);
    setPickedOrg(null);
    setRelSearchQuery('');
    setRelType('Parent Company');
    setIsRelDropdownOpen(false);
  };

  const handleRemoveRelatedOrg = (indexToRemove: number) => {
    setRelatedOrganizations((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Save Handler
  const handleSave = async () => {
    const cleanLocations = locations.map((l) => l.trim()).filter(Boolean);
    if (!cleanLocations.length) {
      toast.error('Add at least one location');
      return;
    }
    if (!selectedCategories.length) {
      toast.error('Select at least one business category');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Enter a valid business email address');
      return;
    }

    try {
      setIsSaving(true);

      const cleanSocialMap: Record<string, string> = {};
      if (socials.facebook.trim()) cleanSocialMap.facebook = normalizeUrl(socials.facebook);
      if (socials.instagram.trim()) cleanSocialMap.instagram = normalizeUrl(socials.instagram);
      if (socials.linkedin.trim()) cleanSocialMap.linkedin = normalizeUrl(socials.linkedin);
      if (socials.twitter.trim()) cleanSocialMap.twitter = normalizeUrl(socials.twitter);
      if (socials.youtube.trim()) cleanSocialMap.youtube = normalizeUrl(socials.youtube);
      if (landingPage.trim()) cleanSocialMap.landingPage = normalizeUrl(landingPage);

      const payload = {
        name: businessName.trim() || 'My Business',
        logoUrl: logoUrl || null,
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        industry: selectedCategories.join(', '),
        businessPhone: phone.trim() || undefined,
        businessEmail: email.trim() || undefined,
        website: website.trim() ? normalizeUrl(website) : undefined,
        streetAddress: street.trim() || undefined,
        city: cleanLocations[0] || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        locations: cleanLocations,
        socialLinks: cleanSocialMap,
        relatedOrganizations,
      };

      await updateBusinessProfile(payload);
      window.dispatchEvent(
        new CustomEvent('business-logo:updated', { detail: { logoUrl: logoUrl || null } })
      );
      toast.success('Business profile updated — now visible in the Directory');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Save profile error', err);
      toast.error(err.message || 'Failed to update business profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[480px] max-h-[88vh] overflow-x-hidden overflow-y-auto p-6 rounded-[14px] sm:rounded-[14px] border-border bg-white dark:bg-card text-card-foreground shadow-[0px_20px_60px_rgba(0,0,0,0.3)]">
        <DialogHeader className="pb-3 border-b border-border/60">
          <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
            Edit Business Profile
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Visible to every member in the Directory
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Loading business profile...</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Business Logo */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Business Logo
              </label>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="text-xs font-semibold flex items-center gap-1.5 h-9"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 h-9"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tagline
              </label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Bulk steel trading you can rely on"
                className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Business Phone & Business Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Business Phone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(512) 555-0148"
                  className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Business Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@morgansteeltrader"
                  className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Website
              </label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. yourbusiness.com"
                className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Landing Page / Custom Link */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Landing Page / Custom Link
              </label>
              <Input
                value={landingPage}
                onChange={(e) => setLandingPage(e.target.value)}
                placeholder="e.g. yourbusiness.com/book-a-call"
                className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                A landing page, portfolio or booking link — shown as a button on your Directory profile.
              </p>
            </div>

            {/* Social Media (optional) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Social Media (optional)
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Shown as icon links on your Directory profile. You can add these now or later.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Facebook className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={socials.facebook}
                    onChange={(e) => setSocials({ ...socials, facebook: e.target.value })}
                    placeholder="facebook.com/yourbusiness"
                    className="pl-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="relative">
                  <Instagram className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={socials.instagram}
                    onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                    placeholder="instagram.com/yourbusiness"
                    className="pl-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="relative">
                  <Linkedin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={socials.linkedin}
                    onChange={(e) => setSocials({ ...socials, linkedin: e.target.value })}
                    placeholder="linkedin.com/company/yourbusiness"
                    className="pl-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="relative">
                  <Twitter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={socials.twitter}
                    onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                    placeholder="x.com/yourbusiness"
                    className="pl-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="relative sm:col-span-2">
                  <Youtube className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    value={socials.youtube}
                    onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                    placeholder="youtube.com/@yourbusiness"
                    className="pl-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Street Address */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Street Address
              </label>
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="301 Congress Ave"
                className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="TX"
                  className="text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="78701"
                  className="text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Locations
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                Add every city or region where you operate — members can filter the Directory by any of them.
              </p>
              <div
                className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-text min-h-[42px]"
                onClick={(e) => {
                  if (e.currentTarget === e.target) {
                    e.currentTarget.querySelector('input')?.focus();
                  }
                }}
              >
                {locations.filter(Boolean).map((loc, i) => (
                  <span
                    key={`${loc}-${i}`}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] dark:bg-slate-800 text-[#0B2447] dark:text-slate-200"
                  >
                    <MapPin className="w-3 h-3 text-[#0B2447] dark:text-slate-300" />
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => removeLocation(i)}
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 hover:bg-slate-300 dark:hover:bg-slate-700 ml-0.5 transition"
                      aria-label={`Remove location ${loc}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  onBlur={commitLocationInput}
                  placeholder={locations.length ? 'Add another...' : 'e.g. Austin'}
                  className="flex-1 min-w-[120px] px-1 py-0.5 text-xs outline-none bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Press Enter or comma to add a city
              </p>
            </div>

            {/* Business Categories */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Business Categories
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Select every category that applies — helps members find you under all relevant filters.
              </p>
              <div className="flex flex-wrap gap-2">
                {CHAMBER_INDUSTRY_OPTIONS.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-[#0B2447] text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Related Organizations */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Related Organizations
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                Link other chamber member businesses you&apos;re connected to — parent company, branches, sister companies and more.
              </p>

              <div
                ref={relContainerRef}
                className="rounded-xl p-3 bg-[#F9FAFB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={pickedOrg ? pickedOrg.name : relSearchQuery}
                    onChange={(e) => {
                      setPickedOrg(null);
                      setRelSearchQuery(e.target.value);
                      setIsRelDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (relSearchResults.length > 0 && !pickedOrg) setIsRelDropdownOpen(true);
                    }}
                    placeholder="Search member businesses..."
                    className="w-full text-sm rounded-lg pl-9 pr-3 py-2.5 border outline-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />

                  {isRelDropdownOpen && !pickedOrg && relSearchQuery.trim().length >= 2 && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                      {isLoadingRelSearch ? (
                        <p className="px-3 py-2.5 text-xs text-slate-400">Searching businesses...</p>
                      ) : relSearchResults.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-slate-400">No matching member businesses</p>
                      ) : (
                        relSearchResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setPickedOrg(c);
                              setRelSearchQuery(c.name);
                              setIsRelDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between border-b last:border-b-0 border-slate-100 dark:border-slate-700/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {c.name}
                              </span>
                            </div>
                            {c.industry && (
                              <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                                {c.industry}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {pickedOrg && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <select
                      value={relType}
                      onChange={(e) =>
                        setRelType(e.target.value as RelatedOrganization['relationshipType'])
                      }
                      className="flex-1 text-xs rounded-lg px-2.5 py-2 border outline-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      {RELATIONSHIP_TYPES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddRelatedOrg}
                      className="bg-[#0B2447] hover:bg-[#1E3A5F] text-white text-xs font-semibold h-8 px-3 flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPickedOrg(null);
                        setRelSearchQuery('');
                      }}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {relatedOrganizations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {relatedOrganizations.map((l, i) => (
                      <span
                        key={`${l.businessId || l.businessName}-${i}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E8EEF6] dark:bg-slate-800 text-[#0B2447] dark:text-slate-200"
                      >
                        <Building2 className="w-3 h-3 text-[#0B2447] dark:text-slate-300 shrink-0" />
                        <span>{l.businessName}</span>
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          · {l.relationshipType}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRelatedOrg(i)}
                          className="ml-0.5 hover:text-red-500 transition cursor-pointer"
                          title="Remove link"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Business Description */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Business Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bulk steel fabrication and structural trading serving builders and manufacturers across the region."
                rows={3}
                className="mt-1 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-[#0B2447] hover:bg-[#1E3A5F] text-white font-semibold py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <span>Save Business Profile</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
