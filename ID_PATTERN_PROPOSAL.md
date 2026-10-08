# Readable Record IDs — Final Convention

> Status: **Approved & implemented** · 2026-10-08 (OD-017 … OD-020 resolved)
> Helper: `backend/src/core/shared/ids.ts` · Tests: `backend/src/test/ids.test.ts`

## Rule

```
<PREFIX>_<scope>_<YYYYMMDD>_<SUFFIX>      e.g. USR_ROCKWELL_20261008_K7P2
```

| Part | Value |
|---|---|
| PREFIX | UPPERCASE table code (table below) |
| scope | chamber **subdomain in UPPERCASE** (never changes); `PLATFORM` for platform-level rows |
| YYYYMMDD | UTC **creation** date |
| SUFFIX | random Crockford base32 (no I/L/O/U); 4 chars, 6 for high-volume rows (logs), 8 for OTP |

**Whole ID is UPPERCASE.** Rows created before this change (incl. `CHAM_littlelm`, `USR_littlelm_…`, `PAUD_platform_…`) keep their IDs.

**Never in an ID:** names, roles, emails, phones, titles, statuses — anything that can change or is PII.
ID is assigned once and never changes (FKs reference it).

### Exceptions
| Case | Format | Example |
|---|---|---|
| Chamber itself | `CHAM_<subdomain>` (subdomain is immutable, OD-018) | `CHAM_ROCKWELL` |
| One row per chamber (`ON CONFLICT(chamber_id)`) | `<PREFIX>_<subdomain>` | `CSET_ROCKWELL`, `GW_ROCKWELL` |
| Secrets (session / verification tokens), request IDs | stay fully random — not record IDs | `sess_…`, `mvt_tok_…`, `req_…` |
| Display codes (separate columns) | unchanged | `APP-2026-12345`, `member_id_display` |

**Existing rows keep their old IDs (OD-020 = A).** Only new rows use this format.

## Usage
```ts
import { newId, chamberKeyedId, formatChamberId, formatReadableId } from '@/core/shared/ids';
const id = await newId(db, 'users', 'USR', { chamberId });               // collision-checked
const logId = await newId(db, 'activity_logs', 'ACT', { chamberId, suffixLength: 6, skipUniqueCheck: true });
const settingsId = await chamberKeyedId(db, 'CSET', chamberId);           // CSET_ROCKWELL
```

## Prefix registry

Implemented now (tables that have code today) are marked ✅. Other tables must use these prefixes when their module is built.

| Table | Prefix | | Table | Prefix |
|---|---|---|---|---|
| platform_chambers | `CHAM` ✅ | | events | `EVT` |
| users | `USR` ✅ | | event_registrations | `REG` ✅ |
| admin_profiles | `ADMP` ✅ | | event_ticket_types | `TKT` |
| user_role_assignments | `URA` ✅ | | event_promo_codes | `PROMO` |
| otp_codes | `OTP` ✅ | | event_sponsorship_tiers | `STIER` |
| platform_audit_logs | `PAUD` ✅ | | event_sponsors | `SPON` |
| activity_logs | `ACT` ✅ | | event_feedback | `EFB` |
| notification_preferences | `NPREF` ✅ | | ceu_credits / ceu_requirements | `CEU` / `CEUR` |
| chamber_settings | `CSET` ✅ (keyed) | | meetings_ | `MTG` |
| payment_gateway_config | `GW` ✅ (keyed) | | messages | `MSG` |
| membership_plans | `PLAN` ✅ | | referrals / referral_people | `REF` / `REFP` |
| applications | `APP` ✅ | | mentorship / mentorship_profiles | `MENT` / `MENP` |
| chamber_memberships | `MEM` ✅ | | ideas / idea_comments / idea_votes | `IDEA` / `ICOM` / `IVOTE` |
| membership_benefit_usage | `MBU` ✅ | | polls / poll_options / poll_votes | `POLL` / `POPT` / `PVOTE` |
| invoices | `INV` ✅ | | reported_content | `RPT` |
| payment_methods | `PM` ✅ | | job_postings / job_applications | `JOB` / `JAPP` |
| business_profiles | `BIZ` ✅ | | marketplace_listings | `MKT` |
| business_members | `BM` ✅ | | announcements | `ANN` |
| roles | `ROLE_<role_key>` (seeded) | | news_releases / blog_posts | `NEWS` / `BLOG` |
| chapters | `CHAP` | | landing_pages | `LPG` |
| groups / group_members | `GRP` / `GMEM` | | forms / form_submissions | `FORM` / `FSUB` |
| user_chapters | `UCH` | | photo_albums / photo_album_images | `ALB` / `IMG` |
| platform_super_admins | `SADM` | | resources | `RES` |
| platform_admin_requests | `PREQ` | | broadcasts / email_campaigns | `BCST` / `CAMP` |
| platform_global_settings | `PSET` | | notifications | `NTF` |
| platform_security_settings | `PSEC` | | courses / course_enrollments | `CRS` / `ENR` |
| platform_integrations | `PINT` | | tasks | `TASK` |
| platform_support_tickets / _messages | `PTKT` / `PTKM` | | store_categories / store_products | `SCAT` / `PROD` |
| platform_tenant_billing | `PBIL` | | store_orders / store_order_items | `ORD` / `ORDI` |
| chamber_integrations | `CINT` | | cart_items | `CART` |
| store_settings / store_shipping_config | `SSET` / `SSHIP` | | rewards / points_history | `RWD` / `PTS` |
| financial_exports / financial_export_schedule | `FEX` / `FXS` | | governance_board_members | `BRD` |
| member_retention_scores | `MRS` | | governance_meetings | `GMTG` |
| business_leads / business_lead_proposals | `LEAD` / `LPROP` | | governance_resolutions | `GRES` |
| contact_requests | `CREQ` | | governance_votes / governance_documents | `GVOTE` / `GDOC` |
| crm_contacts | `CRM` | | support_tickets / support_ticket_messages | `STKT` / `STKM` |
| ai_site_design / ai_agent_capabilities | `AISD` / `AICAP` | | ai_chat_history | `AICH` |
| automation_workflows / _steps / _recipients | `AUTO` / `ASTEP` / `AREC` | | import_history | `IMP` |
