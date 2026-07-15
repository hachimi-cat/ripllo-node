/** Shared types — keep in sync with the ripllo backend. */

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta?: {
    requestId?: string;
    timestamp?: string;
    cursor?: string | null;
    hasMore?: boolean;
  };
}

export class RiplloError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'RiplloError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// ─── Discount codes ─────────────────────────────────────────────────────

export type DiscountType = 'percent' | 'fixed' | 'shipping_percent' | 'shipping_fixed';
export type DiscountScope = 'cart' | 'products' | 'tags';

export interface DiscountCode {
  id: string;
  accountId: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  currency: string;
  scope: DiscountScope;
  productIds: string[];
  tagFilter: string[];
  minPurchaseAmount: number | null;
  maxUsesTotal: number | null;
  maxUsesPerCustomer: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  public: boolean;
  redemptionCount: number;
  source: string | null;
  sourceRefId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCodeListPage {
  items: DiscountCode[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export type ValidateReason =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'NOT_YET_ACTIVE'
  | 'CURRENCY_MISMATCH'
  | 'MIN_PURCHASE'
  | 'GLOBAL_LIMIT'
  | 'PER_CUSTOMER_LIMIT'
  | 'SCOPE_MISMATCH';

export interface ValidateLineItem {
  productId?: string | null;
  price: number;
  quantity: number;
  tags?: string[];
}

export interface ValidateInput {
  accountId: string;
  code: string;
  subtotal: number;
  currency: string;
  shippingCost?: number;
  customerId?: string | null;
  items?: ValidateLineItem[];
}

export interface ValidateResult {
  valid: boolean;
  code?: DiscountCode;
  reason?: ValidateReason;
  discountAmount: number;
  discountShipping: number;
}

export interface RedeemInput {
  accountId: string;
  discountCodeId: string;
  checkoutSessionId: string;
  customerId?: string | null;
  appliedAmount: number;
  appliedShipping?: number;
  externalSource?: string | null;
  externalRef?: string | null;
}

export interface PublicApplicableCode {
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  minPurchaseAmount: number | null;
  expiresAt: string | null;
  estimatedDiscount: number;
  eligible: boolean;
}

// ─── Pixels ─────────────────────────────────────────────────────────────

export interface MerchantPixels {
  id?: string;
  accountId?: string;
  metaPixelId: string | null;
  metaCapiAccessToken?: string | null;
  metaTestEventCode?: string | null;
  googleAnalyticsId: string | null;
  googleAdsConversionId: string | null;
  googleAdsPurchaseLabel: string | null;
  tiktokPixelId: string | null;
  enabled: boolean;
}

export interface PublicPixels {
  metaPixelId: string | null;
  googleAnalyticsId: string | null;
  googleAdsConversionId: string | null;
  googleAdsPurchaseLabel: string | null;
  tiktokPixelId: string | null;
  enabled: boolean;
}

// ─── Feeds ──────────────────────────────────────────────────────────────

export interface MerchantFeedConfig {
  enabled: boolean;
  defaultGoogleProductCategory: string | null;
  includeUnpublished: boolean;
}

// ─── Blog ───────────────────────────────────────────────────────────────

export type BlogPostStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  accountId: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  authorName: string | null;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Abandoned cart ─────────────────────────────────────────────────────

export interface AbandonedCartConfig {
  id?: string;
  accountId?: string;
  enabled: boolean;
  delayHours: number;
  emailSubject: string;
  emailPreview: string;
  discountCodeId: string | null;
}

export interface AbandonedCartReminder {
  id: string;
  accountId: string;
  customerId: string;
  cartId: string;
  email: string;
  cartSnapshot: unknown;
  valueAtSend: number;
  currencyAtSend: string;
  discountCodeId: string | null;
  externalSource: string | null;
  externalRef: string | null;
  sentAt: string;
  recoveredAt: string | null;
  recoveredBySessionId: string | null;
}

export interface RecoveryStats {
  remindersSent: number;
  cartsRecovered: number;
  recoveryRate: number;
  recoveredValueAtSend: number;
  currency: string | null;
}

// ─── Referrals ──────────────────────────────────────────────────────────

export type ReferralAttributionStatus = 'pending' | 'rewarded' | 'voided' | 'expired';

export interface ReferralProgram {
  id: string;
  accountId: string;
  enabled: boolean;
  rewardType: DiscountType;
  referrerValue: number;
  refereeValue: number;
  currency: string;
  minPurchaseAmount: number | null;
  rewardExpiryDays: number;
  attributionWindowDays: number;
  maxRewardsPerReferrer: number | null;
  programTerms: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralLink {
  id: string;
  programId: string;
  accountId: string;
  customerId: string;
  code: string;
  clicks: number;
  signups: number;
  rewards: number;
  revenue: number;
  createdAt: string;
}

export interface ReferralAttribution {
  id: string;
  programId: string;
  accountId: string;
  linkId: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  status: ReferralAttributionStatus;
  referrerRewardCodeId: string | null;
  refereeRewardCodeId: string | null;
  qualifyingCheckoutSessionId: string | null;
  expiresAt: string;
  externalSource: string | null;
  externalRef: string | null;
  clickedAt: string;
  signedUpAt: string | null;
  rewardedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface ProgramStats {
  totalLinks: number;
  totalClicks: number;
  totalSignups: number;
  totalRewards: number;
  attributedRevenue: number;
  conversionRate: number;
}

export interface MyReward {
  role: 'referrer' | 'referee';
  attributionId: string;
  code: string;
  discountType: DiscountType;
  value: number;
  currency: string;
  expiresAt: string | null;
  redeemed: boolean;
  active: boolean;
  earnedAt: string;
}

// ─── Loyalty / points ───────────────────────────────────────────────────

export type PointsLedgerKind = 'earn' | 'redeem' | 'adjust' | 'void';
export type PointsLedgerStatus = 'pending' | 'confirmed' | 'voided';

export interface LoyaltyProgram {
  id: string;
  accountId: string;
  enabled: boolean;
  /** Points granted per IDR 1000 of order gross. */
  earnRatePoints: number;
  /** IDR value of one point at redemption. */
  redeemValueIdr: number;
  marketingCampaignId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyBalance {
  accountId: string;
  customerId: string;
  balance: number;
  exists: boolean;
}

export interface PointsLedgerEntry {
  id: string;
  accountId: string;
  memberId: string;
  customerId: string;
  delta: number;
  kind: PointsLedgerKind;
  status: PointsLedgerStatus;
  externalSource: string | null;
  externalRef: string | null;
  checkoutSessionId: string | null;
  orderId: string | null;
  reversesEntryId: string | null;
  note: string | null;
  createdAt: string;
}

export interface LoyaltyEarnResult {
  created: boolean;
  entryId: string;
  pointsEarned: number;
  balance: number;
}

export interface LoyaltyRedeemResult {
  created: boolean;
  entryId: string;
  pointsRedeemed: number;
  redeemValueIdr: number;
  balance: number;
}

export interface LoyaltyVoidResult {
  voided: boolean;
  reversedEntryId?: string;
  voidEntryId?: string;
  balance?: number;
}

// ─── Partner billing ────────────────────────────────────────────────────

export interface PartnerWorkspace {
  accountId: string;
  partner: string;
  discountRate: number;
  brandName: string | null;
  businessEmail: string | null;
  createdAt: string;
}

export interface PartnerUsageSummary {
  partner: string;
  period: { from: string; to: string };
  totals: {
    redemptions: number;
    referralRewards: number;
    reminders: number;
    loyaltyEarns: number;
    loyaltyRedeems: number;
    chargeableCents: number;
  };
  byMerchant: Array<{
    accountId: string;
    redemptions: number;
    referralRewards: number;
    reminders: number;
    loyaltyEarns: number;
    loyaltyRedeems: number;
    chargeableCents: number;
  }>;
}

// ─── Marketing campaigns (hub) ──────────────────────────────────────────
//
// The MarketingCampaign hub groups one or more child entities (creator
// briefs, affiliate programs, discount codes, abandoned-cart reminders,
// referral programs, blog posts, and product feeds) under a single
// merchant-defined campaign. Every link is optional — child entities
// remain usable standalone.
//
// Prisma model = `MarketingCampaign`; DB table = `MarketingProgram`
// (via @@map, pre-PR-#11 history); API path = /api/v1/marketing-campaigns.
//
// Distinct from `Broadcasts` (email/SMS blasts), which lives at
// /api/v1/broadcasts.

export type MarketingCampaignGoal =
  | 'awareness'
  | 'conversion'
  | 'retention'
  | 'launch'
  | 'other';

export type MarketingCampaignStatus =
  | 'draft'
  | 'live'
  | 'paused'
  | 'completed'
  | 'archived';

export interface MarketingCampaignChildCounts {
  creatorBriefs: number;
  affiliatePrograms: number;
  discountCodes: number;
  cartReminders: number;
  referralPrograms: number;
  blogPosts: number;
  feeds: number;
}

export interface MarketingCampaign {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  goal: MarketingCampaignGoal;
  status: MarketingCampaignStatus;
  budgetIdr: number | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present on list + get responses; absent on create/update/delete. */
  _count?: MarketingCampaignChildCounts;
}

/** Roll-up returned by GET /:id/full. Real cross-product attribution
 *  (Plugipay orders × ripllo attribution rows × storlaunch carts) is a
 *  follow-up sprint — most fields are still stubbed server-side. */
export interface MarketingCampaignPerformance {
  ordersAttributed: number;
  collaborationsDelivered: number;
  affiliatorClicks: number;
  discountRedemptions: number;
  note?: string;
}

/** GET /:id/full — campaign + all linked children + perf roll-up. */
export interface MarketingCampaignFull {
  campaign: MarketingCampaign;
  creatorBriefs: unknown[];
  affiliatePrograms: unknown[];
  discountCodes: unknown[];
  cartReminders: unknown[];
  referralPrograms: unknown[];
  blogPosts: unknown[];
  feeds: unknown[];
  performance: MarketingCampaignPerformance;
}

/** GET /_/selector — lightweight dropdown payload, non-archived only. */
export interface MarketingCampaignSelectorItem {
  id: string;
  name: string;
  status: MarketingCampaignStatus;
  goal: MarketingCampaignGoal;
}

// ─── Webhook events ─────────────────────────────────────────────────────

export interface WebhookEventEnvelope<T = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  accountId: string | null;
  data: T;
  metadata: Record<string, unknown>;
}
