export type RepresentativeAccessLevel = 'full_access' | 'billing_only' | 'events_networking';

export interface RelatedOrganization {
  memberId?: string;
  businessName: string;
  relationshipType: string; // 'Parent Company' | 'Branch Office' | 'Sister Company' | 'Subsidiary' | 'Affiliate'
  linkedAt?: string;
}

export interface BusinessProfileData {
  id: string;
  chamberId: string;
  name: string;
  dbaName?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  website?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  socialLinks: Record<string, string>;
  skills: string[];
  interests: string[];
  locations: string[];
  relatedOrganizations: RelatedOrganization[];
  isVerified: boolean;
  myAccessLevel?: RepresentativeAccessLevel;
  isPrimaryContact?: boolean;
  representatives: TeamRepresentative[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface TeamRepresentative {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  isPrimaryContact: boolean;
  accessLevel: RepresentativeAccessLevel;
  status: 'active' | 'invited' | 'pending' | 'removed';
  createdAt: string;
}

export interface UpdateBusinessProfileInput {
  name: string;
  dbaName?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  description?: string | null;
  industry: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  website?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  socialLinks?: Record<string, string>;
  skills?: string[];
  interests?: string[];
  locations?: string[];
  relatedOrganizations?: RelatedOrganization[];
}

export interface InviteRepresentativeInput {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string | null;
  accessLevel: RepresentativeAccessLevel;
}
