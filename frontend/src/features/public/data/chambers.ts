export interface RegisteredChamber {
  id: string;
  name: string;
  city: string;
  slug: string;
  customDomain?: string;
  membersCount: number;
  estYear?: string;
  headline?: string;
  tagline?: string;
  primaryColor?: string;
  textColor?: string;
  backgroundColor?: string;
  logoUrl?: string | null;
  heroHeadline?: string;
  heroTagline?: string;
  adminName?: string;
  onboarded?: boolean | number;
  status?: string;
}
