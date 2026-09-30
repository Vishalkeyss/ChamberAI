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
  adminName?: string;
  onboarded?: boolean | number;
  status?: string;
}
