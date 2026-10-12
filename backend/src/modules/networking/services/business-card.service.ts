import { AppError, ErrorCodes } from '../../../core/shared/errors';
import { BusinessCardRepository } from '../repositories/business-card.repository';
import { NetworkMembersRepository } from '../repositories/network-members.repository';
import { generateVCard, normalizeWebsite, splitName, vcardFileName } from './vcard.service';

const CARD_NOT_FOUND = 'Business card not found';

/** OD-070: random public share token (a secret link, not a readable record ID). */
function newCardToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `crd_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Social links stored on the business profile (bannerUrl / dbaName share that JSON and are skipped). */
function parseSocialLinks(json: string | null): { network: string; url: string }[] {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json || '{}') || {};
  } catch {
    raw = {};
  }
  return Object.entries(raw)
    .filter(([key, value]) => !['bannerUrl', 'dbaName'].includes(key) && typeof value === 'string')
    .map(([network, value]) => ({ network, url: normalizeWebsite(value as string) }))
    .filter((l): l is { network: string; url: string } => !!l.url);
}

type CardOwner = NonNullable<Awaited<ReturnType<typeof BusinessCardRepository.findOwner>>>;

/** Prompt 05.4 — QR digital business card & vCard. */
export class BusinessCardService {
  /** Live card data (§7.2): user + primary business + chamber branding. */
  private static async buildCard(d1: D1Database, chamberId: string, owner: CardOwner) {
    const [primary, branding] = await Promise.all([
      NetworkMembersRepository.primaryBusinessOf(d1, chamberId, owner.id),
      BusinessCardRepository.chamberBranding(d1, chamberId),
    ]);
    const business = primary ? await BusinessCardRepository.businessDetails(d1, chamberId, primary.businessId) : null;
    const address = business
      ? [business.streetAddress, business.city, [business.state, business.zip].filter(Boolean).join(' ')].filter((p) => p && p.trim()).join(', ')
      : '';

    return {
      // OD-069: no stored colour → the chamber's brand colour.
      themeColor: owner.cardThemeColor || branding?.primaryColor || null,
      customThemeColor: owner.cardThemeColor,
      chamber: {
        name: branding?.orgName || branding?.chamberName || '',
        logoUrl: branding?.logoUrl || null,
      },
      profile: {
        name: owner.name?.trim() || owner.email,
        // OD-071: no member job-title column yet.
        title: null as string | null,
        company: business?.name || null,
        tagline: business?.tagline || null,
        industry: business?.industry || null,
        email: owner.email,
        phone: owner.phone || business?.phone || null,
        website: normalizeWebsite(business?.website),
        address: address || null,
        logoUrl: business?.logoUrl || null,
        avatarUrl: owner.avatarUrl,
        isVerified: !!business?.isVerified,
        socialLinks: parseSocialLinks(business?.socialLinksJson ?? null),
      },
      hasBusiness: !!business,
    };
  }

  /** §9.1 GET /member/business-card */
  static async getMyCard(d1: D1Database, chamberId: string, userId: string) {
    let owner = await BusinessCardRepository.findOwner(d1, chamberId, userId);
    if (!owner) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber members have a business card', 403);

    // OD-070: users created after migration 0018 get their token on first card load.
    if (!owner.cardToken) {
      for (let attempt = 0; attempt < 3 && !owner.cardToken; attempt++) {
        try {
          await BusinessCardRepository.assignToken(d1, chamberId, userId, newCardToken());
        } catch (err: any) {
          // UNIQUE collision on the token: retry with a new one.
          if (!/UNIQUE/i.test(`${err?.message} ${err?.cause?.message || ''}`)) throw err;
        }
        owner = (await BusinessCardRepository.findOwner(d1, chamberId, userId))!;
      }
      if (!owner.cardToken) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Could not create your card link', 500);
    }

    const { hasBusiness, ...card } = await this.buildCard(d1, chamberId, owner);
    return {
      cardToken: owner.cardToken,
      viewsCount: owner.cardViewsCount,
      // OD-072: the public card is only served while the member has an active business link.
      publicCardAvailable: hasBusiness,
      ...card,
    };
  }

  /** PUT /member/business-card — §10 only the theme colour is editable (OD-071). */
  static async updateTheme(d1: D1Database, chamberId: string, userId: string, themeColor: string) {
    const owner = await BusinessCardRepository.findOwner(d1, chamberId, userId);
    if (!owner) throw new AppError(ErrorCodes.FORBIDDEN, 'Only active chamber members have a business card', 403);
    await BusinessCardRepository.setThemeColor(d1, chamberId, userId, themeColor.toUpperCase());
    return this.getMyCard(d1, chamberId, userId);
  }

  private static async publicOwner(d1: D1Database, chamberId: string, token: string) {
    if (!/^crd_[0-9a-f]{24}$/.test(token)) throw new AppError(ErrorCodes.NOT_FOUND, CARD_NOT_FOUND, 404);
    const owner = await BusinessCardRepository.findByToken(d1, chamberId, token);
    if (!owner) throw new AppError(ErrorCodes.NOT_FOUND, CARD_NOT_FOUND, 404);
    const card = await this.buildCard(d1, chamberId, owner);
    if (!card.hasBusiness) throw new AppError(ErrorCodes.NOT_FOUND, CARD_NOT_FOUND, 404);
    return { owner, card };
  }

  /** §9.2 GET /public/card/:token — counts a view unless the signed-in owner opens it (OD-078). */
  static async publicCard(d1: D1Database, chamberId: string, token: string, viewerUserId: string | null) {
    const { owner, card } = await this.publicOwner(d1, chamberId, token);
    const isOwner = viewerUserId === owner.id;
    if (!isOwner) await BusinessCardRepository.incrementViews(d1, chamberId, owner.id);
    const { hasBusiness: _hasBusiness, customThemeColor: _custom, ...publicCard } = card;
    return { cardToken: token, isOwner, ...publicCard };
  }

  /** §9.3 GET /public/card/:token/vcard */
  static async vcard(d1: D1Database, chamberId: string, token: string) {
    const { card } = await this.publicOwner(d1, chamberId, token);
    const { firstName, lastName } = splitName(card.profile.name);
    return {
      body: generateVCard({
        firstName,
        lastName,
        email: card.profile.email,
        phone: card.profile.phone,
        title: card.profile.title,
        company: card.profile.company,
        website: card.profile.website,
      }),
      fileName: vcardFileName(card.profile.name),
    };
  }
}
