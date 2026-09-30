import crypto from 'node:crypto';
import { GeneratedApi } from './api.generated.js';
import {
  ApiEnvelope,
  RiplloError,
  DiscountCode,
  DiscountCodeListPage,
  DiscountType,
  DiscountScope,
  ValidateInput,
  ValidateResult,
  RedeemInput,
  PublicApplicableCode,
  MerchantPixels,
  PublicPixels,
  MerchantFeedConfig,
  BlogPost,
  BlogPostStatus,
  AbandonedCartConfig,
  AbandonedCartReminder,
  RecoveryStats,
  ReferralProgram,
  ReferralLink,
  ReferralAttribution,
  ProgramStats,
  MyReward,
  LoyaltyProgram,
  LoyaltyBalance,
  LoyaltyEarnResult,
  LoyaltyRedeemResult,
  LoyaltyVoidResult,
  PointsLedgerEntry,
  PartnerWorkspace,
  PartnerUsageSummary,
  MarketingCampaign,
  MarketingCampaignGoal,
  MarketingCampaignStatus,
  MarketingCampaignFull,
  MarketingCampaignSelectorItem,
} from './types.js';

export interface RiplloClientOptions {
  /** HMAC access key id, e.g. 'AKIARPLO<random>'. */
  keyId: string;
  /** HMAC secret. */
  secret: string;
  /** Base URL. Default https://ripllo.com. */
  baseUrl?: string;
  /** Optional merchant accountId — forwarded as `X-Ripllo-On-Behalf-Of`.
   *  Only allowed when `keyId` holds the `ripllo:platform:admin` scope. */
  onBehalfOf?: string;
  /** Per-request fetch timeout. Default 30s. */
  timeoutMs?: number;
}

interface SignInput {
  method: string;
  path: string;
  body: string | null;
  idempotencyKey?: string;
}

export interface FetchArgs {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  onBehalfOf?: string;
}

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  const u = new URLSearchParams();
  for (const [k, v] of entries) u.set(k, String(v));
  return `?${u.toString()}`;
}

// ─── Input shapes ────────────────────────────────────────────────────────

export interface DiscountCodeCreateInput {
  code: string;
  description?: string | null;
  type: DiscountType;
  value: number;
  currency: string;
  scope?: DiscountScope;
  productIds?: string[];
  tagFilter?: string[];
  minPurchaseAmount?: number | null;
  maxUsesTotal?: number | null;
  maxUsesPerCustomer?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  active?: boolean;
  public?: boolean;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  coverImage?: string | null;
  status?: BlogPostStatus;
  publishedAt?: string | null;
  authorName?: string | null;
  tags?: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface ReferralProgramInput {
  enabled?: boolean;
  rewardType: DiscountType;
  referrerValue: number;
  refereeValue: number;
  currency: string;
  minPurchaseAmount?: number | null;
  rewardExpiryDays?: number;
  attributionWindowDays?: number;
  maxRewardsPerReferrer?: number | null;
  programTerms?: string | null;
}

export interface LoyaltyProgramInput {
  enabled?: boolean;
  /** Points granted per IDR 1000 of order gross. */
  earnRatePoints: number;
  /** IDR value of one point at redemption. */
  redeemValueIdr: number;
  marketingCampaignId?: string | null;
}

export interface MarketingCampaignCreateInput {
  name: string;
  description?: string | null;
  goal?: MarketingCampaignGoal;
  status?: MarketingCampaignStatus;
  budgetIdr?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  notes?: string | null;
}

export type MarketingCampaignUpdateInput = Partial<MarketingCampaignCreateInput>;

export interface MarketingCampaignListParams {
  /** Comma-joined list, or array — narrowed to known values. */
  status?: MarketingCampaignStatus | MarketingCampaignStatus[] | string;
  limit?: number;
  cursor?: string;
}

export interface RecordReminderInput {
  accountId: string;
  customerId: string;
  cartId: string;
  email: string;
  cartSnapshot: unknown;
  valueAtSend: number;
  currencyAtSend: string;
  discountCodeId?: string | null;
  externalSource?: string | null;
  externalRef?: string | null;
}

export class RiplloClient {
  private readonly keyId: string;
  private readonly secret: string;
  private readonly baseUrl: string;
  private readonly defaultOnBehalfOf: string | undefined;
  private readonly timeoutMs: number;

  constructor(opts: RiplloClientOptions) {
    if (!opts.keyId || !opts.secret) {
      throw new Error('RiplloClient: keyId and secret are required');
    }
    this.keyId = opts.keyId;
    this.secret = opts.secret;
    this.baseUrl = (opts.baseUrl ?? 'https://ripllo.com').replace(/\/+$/, '');
    this.defaultOnBehalfOf = opts.onBehalfOf;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** Clone scoped to a specific merchant. Use with platform-admin keys. */
  forMerchant(accountId: string): RiplloClient {
    return new RiplloClient({
      keyId: this.keyId,
      secret: this.secret,
      baseUrl: this.baseUrl,
      onBehalfOf: accountId,
      timeoutMs: this.timeoutMs,
    });
  }

  // ─── Low-level request ───────────────────────────────────────

  private sign({ method, path, body, idempotencyKey }: SignInput): { signature: string; timestamp: string } {
    const ts = String(Math.floor(Date.now() / 1000));
    const bodyHash = crypto.createHash('sha256').update(body ?? '').digest('hex');
    const idem = idempotencyKey ? `\n${idempotencyKey}` : '';
    // Sign the path WITHOUT query string. The backend verifier strips
    // the query before reconstructing the string-to-sign (req.originalUrl
    // .split('?')[0]), so signing the full path here causes a mismatch
    // on every request that carries query params (`?limit=`, `?status=`,
    // etc.). This bug had been latent because most SDK calls in prod
    // didn't carry query params.
    const pathToSign = path.split('?')[0] ?? path;
    const stringToSign = `${method.toUpperCase()}\n${pathToSign}\n${ts}\n${bodyHash}${idem}`;
    const signature = crypto.createHmac('sha256', this.secret).update(stringToSign).digest('hex');
    return { signature, timestamp: ts };
  }

  async request<T>(args: FetchArgs): Promise<T> {
    const bodyJson = args.body !== undefined ? JSON.stringify(args.body) : null;
    const { signature, timestamp } = this.sign({
      method: args.method,
      path: args.path,
      body: bodyJson,
      idempotencyKey: args.idempotencyKey,
    });
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Ripllo-HMAC-SHA256 keyId=${this.keyId}, scope=*, signature=${signature}`,
      'X-Ripllo-Timestamp': timestamp,
      ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
      ...(args.idempotencyKey ? { 'Idempotency-Key': args.idempotencyKey } : {}),
    };
    const effectiveOnBehalf = args.onBehalfOf ?? this.defaultOnBehalfOf;
    if (effectiveOnBehalf) headers['X-Ripllo-On-Behalf-Of'] = effectiveOnBehalf;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${args.path}`, {
        method: args.method,
        headers,
        body: bodyJson ?? undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if ((e as Error).name === 'AbortError') {
        throw new RiplloError(0, 'timeout', `Ripllo request timed out after ${this.timeoutMs}ms`);
      }
      throw new RiplloError(0, 'network_error', (e as Error).message);
    }
    clearTimeout(timer);

    const text = await res.text();
    let env: ApiEnvelope<T>;
    try { env = JSON.parse(text) as ApiEnvelope<T>; }
    catch { throw new RiplloError(res.status, 'invalid_response', `Non-JSON response: ${text.slice(0, 200)}`); }
    if (!res.ok || env.error) {
      const err = env.error ?? { code: 'unknown', message: `HTTP ${res.status}` };
      throw new RiplloError(res.status, err.code, err.message, env.meta?.requestId);
    }
    return env.data as T;
  }

  private genIdem(): string {
    return `idem_${crypto.randomUUID()}`;
  }

  // ─── Resources ───────────────────────────────────────────────

  discountCodes = {
    list: (params: { limit?: number; cursor?: string; active?: boolean } = {}) =>
      this.request<DiscountCodeListPage>({ method: 'GET', path: `/api/v1/discount-codes${qs(params)}` }),
    get: (id: string) =>
      this.request<DiscountCode>({ method: 'GET', path: `/api/v1/discount-codes/${id}` }),
    create: (input: DiscountCodeCreateInput) =>
      this.request<DiscountCode>({ method: 'POST', path: '/api/v1/discount-codes', body: input, idempotencyKey: this.genIdem() }),
    update: (id: string, patch: Partial<DiscountCodeCreateInput>) =>
      this.request<DiscountCode>({ method: 'PATCH', path: `/api/v1/discount-codes/${id}`, body: patch }),
    archive: (id: string) =>
      this.request<{ id: string; active: boolean }>({ method: 'DELETE', path: `/api/v1/discount-codes/${id}` }),
    /** Read-only validation for cart preview. */
    validate: (input: ValidateInput) =>
      this.request<ValidateResult>({ method: 'POST', path: '/api/v1/discount-codes/validate', body: input }),
    /** Idempotent redemption — call from payment-success path. */
    redeem: (input: RedeemInput) =>
      this.request<{ id: string; created: boolean }>({ method: 'POST', path: '/api/v1/discount-codes/redeem', body: input }),
    /** Public applicable-codes list for storefront teaser. */
    applicable: (accountId: string, params: { currency?: string; productId?: string; tags?: string; subtotal?: number } = {}) =>
      this.request<{ items: PublicApplicableCode[] }>({ method: 'GET', path: `/api/v1/discount-codes/applicable/${accountId}${qs(params)}` }),
  };

  pixels = {
    get: () =>
      this.request<MerchantPixels>({ method: 'GET', path: '/api/v1/pixels' }),
    update: (input: Partial<MerchantPixels>) =>
      this.request<MerchantPixels>({ method: 'PATCH', path: '/api/v1/pixels', body: input }),
    /** Storefront-public read; never includes CAPI secret. */
    public: (accountId: string) =>
      this.request<PublicPixels | null>({ method: 'GET', path: `/api/v1/pixels/public/${accountId}` }),
  };

  feeds = {
    getConfig: () =>
      this.request<MerchantFeedConfig>({ method: 'GET', path: '/api/v1/feeds/config' }),
    updateConfig: (input: Partial<MerchantFeedConfig>) =>
      this.request<MerchantFeedConfig>({ method: 'PATCH', path: '/api/v1/feeds/config', body: input }),
    googleFeedUrl: (accountId: string) => `${this.baseUrl}/api/v1/feeds/google/${accountId}.xml`,
  };

  blog = {
    list: (params: { status?: BlogPostStatus } = {}) =>
      this.request<{ posts: BlogPost[] }>({ method: 'GET', path: `/api/v1/blog${qs(params)}` }),
    get: (id: string) =>
      this.request<{ post: BlogPost }>({ method: 'GET', path: `/api/v1/blog/${id}` }),
    create: (input: BlogPostInput) =>
      this.request<{ post: BlogPost }>({ method: 'POST', path: '/api/v1/blog', body: input, idempotencyKey: this.genIdem() }),
    update: (id: string, patch: Partial<BlogPostInput>) =>
      this.request<{ post: BlogPost }>({ method: 'PATCH', path: `/api/v1/blog/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/blog/${id}` }),
    publicList: (accountId: string) =>
      this.request<{ posts: Pick<BlogPost, 'id' | 'slug' | 'title' | 'excerpt' | 'coverImage' | 'authorName' | 'tags' | 'publishedAt'>[] }>({
        method: 'GET',
        path: `/api/v1/blog/public/${accountId}`,
      }),
    publicGet: (accountId: string, slug: string) =>
      this.request<{ post: BlogPost }>({ method: 'GET', path: `/api/v1/blog/public/${accountId}/${slug}` }),
  };

  abandonedCart = {
    getConfig: () =>
      this.request<AbandonedCartConfig>({ method: 'GET', path: '/api/v1/abandoned-cart/config' }),
    updateConfig: (input: Partial<AbandonedCartConfig>) =>
      this.request<AbandonedCartConfig>({ method: 'PATCH', path: '/api/v1/abandoned-cart/config', body: input }),
    listReminders: (params: { limit?: number } = {}) =>
      this.request<{ items: AbandonedCartReminder[] }>({ method: 'GET', path: `/api/v1/abandoned-cart/reminders${qs(params)}` }),
    stats: (params: { windowDays?: number } = {}) =>
      this.request<RecoveryStats>({ method: 'GET', path: `/api/v1/abandoned-cart/stats${qs(params)}` }),
    recordReminder: (input: RecordReminderInput) =>
      this.request<{ id: string; created: boolean; reason?: 'opted_out' }>({
        method: 'POST',
        path: '/api/v1/abandoned-cart/reminders',
        body: input,
      }),
    markRecovered: (input: { accountId: string; customerId: string; checkoutSessionId: string; completedAt?: string }) =>
      this.request<{ recovered: boolean; reminderId?: string }>({
        method: 'POST',
        path: '/api/v1/abandoned-cart/recover',
        body: input,
      }),
  };

  referrals = {
    getProgram: () =>
      this.request<ReferralProgram | null>({ method: 'GET', path: '/api/v1/referrals/program' }),
    putProgram: (input: ReferralProgramInput) =>
      this.request<ReferralProgram>({ method: 'PUT', path: '/api/v1/referrals/program', body: input }),
    stats: () =>
      this.request<ProgramStats>({ method: 'GET', path: '/api/v1/referrals/stats' }),
    issueLink: (input: { accountId: string; customerId: string }) =>
      this.request<{ link: ReferralLink | null }>({ method: 'POST', path: '/api/v1/referrals/links/issue', body: input }),
    resolveLink: (accountId: string, code: string) =>
      this.request<{ link: ReferralLink }>({ method: 'GET', path: `/api/v1/referrals/links/${accountId}/${code}` }),
    recordClick: (input: { accountId: string; code: string }) =>
      this.request<{ linkId: string; programId: string } | null>({
        method: 'POST',
        path: '/api/v1/referrals/links/click',
        body: input,
      }),
    attributeOnSignup: (input: {
      accountId: string;
      refereeCustomerId: string;
      refereeEmail: string;
      referrerEmail?: string | null;
      linkCode: string;
      externalSource?: string | null;
      externalRef?: string | null;
    }) =>
      this.request<{ attribution: ReferralAttribution | null }>({
        method: 'POST',
        path: '/api/v1/referrals/attributions/signup',
        body: input,
      }),
    attributeCheckoutStart: (input: {
      accountId: string;
      customerId: string;
      checkoutSessionId: string;
    }) =>
      this.request<{ stamped: boolean; attributionId?: string }>({
        method: 'POST',
        path: '/api/v1/referrals/attributions/checkout-start',
        body: input,
      }),
    fulfillRewardOnPayment: (input: {
      checkoutSessionId: string;
      status: string;
      currency: string;
      amount: number;
    }) =>
      this.request<{
        issued: boolean;
        reason?: string;
        referrerCodeId?: string;
        refereeCodeId?: string;
      }>({
        method: 'POST',
        path: '/api/v1/referrals/attributions/fulfill',
        body: input,
      }),
    voidAttributionOnRefund: (checkoutSessionId: string) =>
      this.request<{ voided: boolean; clawedBack: boolean }>({
        method: 'POST',
        path: '/api/v1/referrals/attributions/void',
        body: { checkoutSessionId },
      }),
    listMyRewards: (accountId: string, customerId: string) =>
      this.request<{ items: MyReward[] }>({
        method: 'GET',
        path: `/api/v1/referrals/rewards/${accountId}/${customerId}`,
      }),
    expirePending: () =>
      this.request<{ expired: number }>({ method: 'POST', path: '/api/v1/referrals/sweeps/expire-pending' }),
  };

  // ─── Loyalty / points ───────────────────────────────────────
  loyalty = {
    getProgram: () =>
      this.request<LoyaltyProgram | null>({ method: 'GET', path: '/api/v1/loyalty/program' }),
    putProgram: (input: LoyaltyProgramInput) =>
      this.request<LoyaltyProgram>({ method: 'PUT', path: '/api/v1/loyalty/program', body: input }),
    balance: (customerId: string) =>
      this.request<LoyaltyBalance>({ method: 'GET', path: `/api/v1/loyalty/members/${encodeURIComponent(customerId)}/balance` }),
    /** Idempotent points-earn — call from order-paid path. */
    earn: (input: {
      customerId: string;
      orderGrossIdr: number;
      externalSource?: string | null;
      externalRef?: string | null;
      checkoutSessionId?: string | null;
      orderId?: string | null;
    }) =>
      this.request<LoyaltyEarnResult>({ method: 'POST', path: '/api/v1/loyalty/earn', body: input, idempotencyKey: this.genIdem() }),
    /** Idempotent points-spend. */
    redeem: (input: {
      customerId: string;
      points: number;
      externalSource?: string | null;
      externalRef?: string | null;
      checkoutSessionId?: string | null;
      orderId?: string | null;
    }) =>
      this.request<LoyaltyRedeemResult>({ method: 'POST', path: '/api/v1/loyalty/redeem', body: input, idempotencyKey: this.genIdem() }),
    /** Claw back a prior earn/redeem on refund — keyed by externalRef. */
    void: (input: { externalRef: string; externalSource?: string | null }) =>
      this.request<LoyaltyVoidResult>({ method: 'POST', path: '/api/v1/loyalty/void', body: input }),
    history: (customerId: string, params: { limit?: number } = {}) =>
      this.request<{ items: PointsLedgerEntry[] }>({
        method: 'GET',
        path: `/api/v1/loyalty/members/${encodeURIComponent(customerId)}/history${qs(params)}`,
      }),
  };

  /**
   * Generic passthrough — for partners (storlaunch / fulkruma) that
   * need to forward arbitrary merchant-portal requests to ripllo
   * without us hand-writing a typed method per resource. The partner's
   * frontend speaks ripllo's response envelope already, so the
   * partner backend just relays.
   *
   * Returns the parsed `data` field of ripllo's envelope, same as
   * every typed method above. Errors surface as `RiplloError`.
   */
  async passthrough<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method, path, body });
  }

  /** Every feature route, one method each (generated from the API spec: api.generated.ts). */
  readonly api: GeneratedApi = new GeneratedApi(this);

  /** The call behind `client.api.*`: signed like every other request. */
  async apigenRequest(method: string, path: string, query: Record<string, unknown> | undefined, body: unknown): Promise<unknown> {
    const qs = query
      ? new URLSearchParams(
          Object.entries(query).map(([k, v]): [string, string] => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
        ).toString()
      : '';
    return this.request<unknown>({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: qs ? `${path}?${qs}` : path,
      body,
      idempotencyKey: method === 'GET' ? undefined : this.genIdem(),
    });
  }

  // ─── API keys ────────────────────────────────────────────────
  apiKeys = {
    list: () => this.request<{ apiKeys: unknown[] }>({ method: 'GET', path: '/api/v1/api-keys' }),
    /** The `secret` comes back on this response only — it is never readable again. */
    create: (input: { name: string; scopes?: ('read' | 'write' | 'admin')[] }) =>
      this.request<{ apiKey: Record<string, unknown>; secret: string }>({ method: 'POST', path: '/api/v1/api-keys', body: input, idempotencyKey: this.genIdem() }),
    revoke: (id: string) =>
      this.request<{ apiKey: { id: string; revokedAt: string } }>({ method: 'POST', path: `/api/v1/api-keys/${id}/revoke`, body: {} }),
  };

  // ─── Webhook endpoints + events ─────────────────────────────
  webhooks = {
    listEndpoints: () =>
      this.request<{ endpoints: unknown[] }>({ method: 'GET', path: '/api/v1/webhooks/endpoints' }),
    createEndpoint: (input: { url: string; events?: string[]; description?: string }) =>
      this.request<{ endpoint: Record<string, unknown> }>({ method: 'POST', path: '/api/v1/webhooks/endpoints', body: input, idempotencyKey: this.genIdem() }),
    updateEndpoint: (id: string, patch: Record<string, unknown>) =>
      this.request<{ endpoint: Record<string, unknown> }>({ method: 'PATCH', path: `/api/v1/webhooks/endpoints/${id}`, body: patch }),
    deleteEndpoint: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/webhooks/endpoints/${id}` }),
    listEvents: (params: { limit?: number; cursor?: string; type?: string } = {}) =>
      this.request<{ events: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/webhooks/events${qs(params)}` }),
  };

  // ─── Audit log ───────────────────────────────────────────────
  auditLog = {
    list: (params: { limit?: number; cursor?: string; since?: string; eventType?: string } = {}) =>
      this.request<{ entries: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/audit-log${qs(params)}` }),
  };

  // ─── Integrations (status + email config) ───────────────────
  integrations = {
    status: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/integrations/status' }),
    getEmail: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/integrations/email' }),
    updateEmail: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PUT', path: '/api/v1/integrations/email', body: input }),
  };

  // ─── Billing (merchant subscription to Ripllo) ──────────────
  billing = {
    plans: () => this.request<unknown[]>({ method: 'GET', path: '/api/v1/billing/plans' }),
    currentPlan: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/plan' }),
    subscription: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/subscription' }),
    usage: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/billing/usage' }),
    invoices: (params: { limit?: number; cursor?: string } = {}) =>
      this.request<{ invoices: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/billing/invoices${qs(params)}` }),
    checkout: (input: { planId: string; successUrl?: string; cancelUrl?: string }) =>
      this.request<{ url: string; sessionId: string }>({ method: 'POST', path: '/api/v1/billing/checkout', body: input }),
    cancel: () => this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/billing/cancel', body: {} }),
  };

  // ─── Uploads (merchant + creator/affiliator scoped) ─────────
  uploads = {
    /** `kind` must be `compose-asset` or `merchant-logo`; the key is server-generated. */
    signMerchant: (input: { kind: string; contentType: string }) =>
      this.request<{ url: string; key: string; contentType: string; expiresIn: number }>({ method: 'POST', path: '/api/v1/uploads/sign-merchant', body: input }),
    getMerchantAsset: (params: { key: string }) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/uploads/merchant-asset${qs(params)}` }),
    /** `kind` is one of kyc-id | kyc-selfie | profile-avatar | deliverable-asset. */
    sign: (input: { kind: string; contentType: string; collaborationId?: string; deliverableId?: string }) =>
      this.request<{ url: string; key: string; contentType: string; expiresIn: number }>({ method: 'POST', path: '/api/v1/uploads/sign', body: input }),
    getAvatar: (params: { key?: string } = {}) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/uploads/avatar${qs(params)}` }),
    getDeliverable: (params: { key: string }) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/uploads/deliverable${qs(params)}` }),
  };

  // ─── Creator marketplace: campaigns / programs / collaborations ─
  campaigns = {
    list: () => this.request<{ campaigns: unknown[] }>({ method: 'GET', path: '/api/v1/campaigns' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/campaigns', body: input, idempotencyKey: this.genIdem() }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/campaigns/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/campaigns/${id}`, body: patch }),
    inviteCreator: (id: string, input: { creatorId: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/campaigns/${id}/invitations`, body: input }),
    listApplications: (id: string) =>
      this.request<{ applications: unknown[] }>({ method: 'GET', path: `/api/v1/campaigns/${id}/applications` }),
    acceptApplication: (id: string, applicationId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/campaigns/${id}/applications/${applicationId}/accept`, body: {} }),
    rejectApplication: (id: string, applicationId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/campaigns/${id}/applications/${applicationId}/reject`, body: {} }),
    analytics: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/campaigns/${id}/analytics` }),
  };

  programs = {
    list: () => this.request<{ programs: unknown[] }>({ method: 'GET', path: '/api/v1/programs' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/programs', body: input, idempotencyKey: this.genIdem() }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/programs/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/programs/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/programs/${id}` }),
    listEnrollments: (id: string) =>
      this.request<{ enrollments: unknown[] }>({ method: 'GET', path: `/api/v1/programs/${id}/enrollments` }),
    approveEnrollment: (id: string, enrollmentId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/programs/${id}/enrollments/${enrollmentId}/approve`, body: {} }),
    rejectEnrollment: (id: string, enrollmentId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/programs/${id}/enrollments/${enrollmentId}/reject`, body: {} }),
    revokeEnrollment: (id: string, enrollmentId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/programs/${id}/enrollments/${enrollmentId}/revoke`, body: {} }),
    commissions: (params: { limit?: number; cursor?: string } = {}) =>
      this.request<{ commissions: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/programs/commissions${qs(params)}` }),
    // Short aliases (v0.2.1) — ergonomic for CLI consumers.
    approve: (id: string, enrollmentId: string) => this.programs.approveEnrollment(id, enrollmentId),
    reject: (id: string, enrollmentId: string) => this.programs.rejectEnrollment(id, enrollmentId),
    revoke: (id: string, enrollmentId: string) => this.programs.revokeEnrollment(id, enrollmentId),
    enrollments: (id: string) => this.programs.listEnrollments(id),
  };

  collaborations = {
    fromApplication: (applicationId: string, input: Record<string, unknown> = {}) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/from-application/${applicationId}`, body: input }),
    list: () => this.request<{ collaborations: unknown[] }>({ method: 'GET', path: '/api/v1/collaborations' }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/collaborations/${id}` }),
    /** Records an ALREADY-uploaded object key as the draft; the route takes
     *  `{ originalKey }` (uploadKeySchema), not filename/contentType. Get the
     *  key from `uploads.sign({ kind: 'deliverable-asset', ... })` first. */
    uploadDeliverableKey: (id: string, deliverableId: string, input: { originalKey: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/deliverables/${deliverableId}/upload-key`, body: input }),
    approveDeliverable: (id: string, deliverableId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/deliverables/${deliverableId}/approve`, body: {} }),
    /** reviewSchema is `{ notes?: string }` — a `reason` field is dropped. */
    rejectDeliverable: (id: string, deliverableId: string, input: { notes?: string } = {}) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/deliverables/${deliverableId}/reject`, body: input }),
    publishDeliverable: (id: string, deliverableId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/deliverables/${deliverableId}/published`, body: {} }),
    approveCollaboration: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/approve`, body: {} }),
    cancelCollaboration: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/collaborations/${id}/cancel`, body: {} }),
    // Short aliases (v0.2.1).
    approve: (id: string) => this.collaborations.approveCollaboration(id),
    cancel: (id: string) => this.collaborations.cancelCollaboration(id),
    deliverables: {
      approve: (id: string, deliverableId: string) => this.collaborations.approveDeliverable(id, deliverableId),
      reject: (id: string, deliverableId: string, input: { notes?: string } = {}) =>
        this.collaborations.rejectDeliverable(id, deliverableId, input),
      publish: (id: string, deliverableId: string) => this.collaborations.publishDeliverable(id, deliverableId),
      uploadKey: (id: string, deliverableId: string, input: { originalKey: string }) =>
        this.collaborations.uploadDeliverableKey(id, deliverableId, input),
    },
  };

  insights = {
    overview: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/insights/overview' }),
    programDetail: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/insights/programs/${id}` }),
    campaignDetail: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/insights/campaigns/${id}` }),
    commissionsTrend: (params: { days?: number } = {}) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/insights/commissions-trend${qs(params)}` }),
  };

  channels = {
    list: () => this.request<{ channels: unknown[] }>({ method: 'GET', path: '/api/v1/channels' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/channels', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/channels/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/channels/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/channels/${id}` }),
    test: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/channels/${id}/test`, body: {} }),
    dnsRecords: (id: string) =>
      this.request<{ records: unknown[] }>({ method: 'GET', path: `/api/v1/channels/${id}/dns-records` }),
    oauthStart: (provider: string) =>
      this.request<{ url: string }>({ method: 'GET', path: `/api/v1/channels/oauth/${provider}/start` }),
    // Short alias (v0.2.1).
    dns: (id: string) => this.channels.dnsRecords(id),
  };

  contacts = {
    /** GET /contacts — free-text filter is `q` (email / first / last / phone). */
    list: (params: { limit?: number; cursor?: string; q?: string } = {}) =>
      this.request<{ contacts: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/contacts${qs(params)}` }),
    import: (input: Record<string, unknown>) =>
      this.request<{ imported: number }>({ method: 'POST', path: '/api/v1/contacts/import', body: input }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/contacts', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/contacts/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/contacts/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/contacts/${id}` }),
  };

  contactLists = {
    list: () => this.request<{ lists: unknown[] }>({ method: 'GET', path: '/api/v1/contact-lists' }),
    create: (input: { name: string; description?: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/contact-lists', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/contact-lists/${id}` }),
    addMember: (id: string, input: { contactId: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/contact-lists/${id}/members`, body: input }),
    removeMember: (id: string, contactId: string) =>
      this.request<{ removed: boolean }>({ method: 'DELETE', path: `/api/v1/contact-lists/${id}/members/${contactId}` }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/contact-lists/${id}` }),
  };

  // ─── Broadcasts (email/SMS blasts) ──────────────────────────
  //
  // Backed by /api/v1/broadcasts on the server. Prisma model =
  // `Broadcast`, DB table = `MarketingCampaign` (via @@map — kept for
  // history). Distinct from `marketingCampaigns` (the campaign hub)
  // which lives at /api/v1/marketing-campaigns.
  broadcasts = {
    list: () => this.request<unknown[]>({ method: 'GET', path: '/api/v1/broadcasts' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/broadcasts', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/broadcasts/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/broadcasts/${id}`, body: patch }),
    send: (id: string, input: Record<string, unknown> = {}) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/broadcasts/${id}/send`, body: input, idempotencyKey: this.genIdem() }),
    /** POST /:id/send-test — the server reads `provider` + `recipient`. */
    sendTest: (id: string, input: { provider: string; recipient: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/broadcasts/${id}/send-test`, body: input }),
    listTemplates: () =>
      this.request<{ templates: unknown[] }>({ method: 'GET', path: '/api/v1/broadcasts/templates' }),
    createTemplate: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/broadcasts/templates', body: input }),
    updateTemplate: (templateId: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/broadcasts/templates/${templateId}`, body: patch }),
    compileTemplate: (input: Record<string, unknown>) =>
      this.request<{ html: string }>({ method: 'POST', path: '/api/v1/broadcasts/templates/compile', body: input }),
    // Nested templates accessor (v0.2.1) — ergonomic alias.
    templates: {
      list: () => this.broadcasts.listTemplates(),
      create: (input: Record<string, unknown>) => this.broadcasts.createTemplate(input),
      update: (templateId: string, patch: Record<string, unknown>) =>
        this.broadcasts.updateTemplate(templateId, patch),
      compile: (input: Record<string, unknown>) => this.broadcasts.compileTemplate(input),
    },
  };

  // ─── Marketing campaigns (hub) ──────────────────────────────
  //
  // Top-level marketing-campaign hub. Groups creator briefs, affiliate
  // programs, discount codes, abandoned-cart reminders, referral
  // programs, blog posts, and feeds under one merchant-defined
  // campaign. Every child link is optional.
  //
  // Backed by /api/v1/marketing-campaigns (Prisma model
  // `MarketingCampaign` → DB table `MarketingProgram` via @@map).
  //
  // Distinct from `broadcasts` (email/SMS blasts) which lives at
  // /api/v1/broadcasts.
  marketingCampaigns = {
    list: (params: MarketingCampaignListParams = {}) => {
      const q: Record<string, unknown> = { ...params };
      if (Array.isArray(params.status)) q.status = params.status.join(',');
      return this.request<{ campaigns: MarketingCampaign[] }>({
        method: 'GET',
        path: `/api/v1/marketing-campaigns${qs(q)}`,
      });
    },
    get: (id: string) =>
      this.request<MarketingCampaign>({ method: 'GET', path: `/api/v1/marketing-campaigns/${id}` }),
    /** GET /:id/full — hub + all linked children + perf roll-up. */
    getFull: (id: string) =>
      this.request<MarketingCampaignFull>({
        method: 'GET',
        path: `/api/v1/marketing-campaigns/${id}/full`,
      }),
    /** GET /_/selector — lightweight dropdown payload (non-archived). */
    selector: () =>
      this.request<{ campaigns: MarketingCampaignSelectorItem[] }>({
        method: 'GET',
        path: '/api/v1/marketing-campaigns/_/selector',
      }),
    create: (input: MarketingCampaignCreateInput) =>
      this.request<MarketingCampaign>({
        method: 'POST',
        path: '/api/v1/marketing-campaigns',
        body: input,
        idempotencyKey: this.genIdem(),
      }),
    update: (id: string, patch: MarketingCampaignUpdateInput) =>
      this.request<MarketingCampaign>({
        method: 'PATCH',
        path: `/api/v1/marketing-campaigns/${id}`,
        body: patch,
      }),
    /** Soft-delete via status='archived'. Server keeps the row + child FKs intact. */
    delete: (id: string) =>
      this.request<MarketingCampaign>({
        method: 'DELETE',
        path: `/api/v1/marketing-campaigns/${id}`,
      }),
  };

  funnels = {
    list: () => this.request<{ funnels: unknown[] }>({ method: 'GET', path: '/api/v1/funnels' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/funnels', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/funnels/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/funnels/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/funnels/${id}` }),
    setSteps: (id: string, input: { steps: unknown[] } | unknown[]) => {
      const body = Array.isArray(input) ? { steps: input } : input;
      return this.request<Record<string, unknown>>({ method: 'PUT', path: `/api/v1/funnels/${id}/steps`, body });
    },
    enroll: (id: string, input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/funnels/${id}/enroll`, body: input }),
    analytics: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/funnels/${id}/analytics` }),
    listEnrollments: (id: string) =>
      this.request<{ enrollments: unknown[] }>({ method: 'GET', path: `/api/v1/funnels/${id}/enrollments` }),
  };

  inbox = {
    listThreads: (params: { limit?: number; cursor?: string } = {}) =>
      this.request<{ threads: unknown[]; nextCursor?: string }>({ method: 'GET', path: `/api/v1/inbox/threads${qs(params)}` }),
    getThread: (provider: string, handle: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/inbox/threads/${provider}/${encodeURIComponent(handle)}` }),
    markRead: (threadId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/inbox/${threadId}/read`, body: {} }),
    archive: (threadId: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/inbox/${threadId}/archive`, body: {} }),
  };

  audienceSegments = {
    list: () => this.request<{ segments: unknown[] }>({ method: 'GET', path: '/api/v1/audience-segments' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/audience-segments', body: input }),
    get: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/audience-segments/${id}` }),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: `/api/v1/audience-segments/${id}`, body: patch }),
    delete: (id: string) =>
      this.request<{ deleted: boolean }>({ method: 'DELETE', path: `/api/v1/audience-segments/${id}` }),
    preview: (id: string, input: Record<string, unknown> = {}) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/audience-segments/${id}/preview`, body: input }),
    previewAdhoc: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/audience-segments/preview', body: input }),
  };

  // ─── Profiles (merchant / creator / affiliator) ─────────────
  merchantProfile = {
    me: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/merchants/me' }),
    updateMe: (patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PUT', path: '/api/v1/merchants/me', body: patch }),
    publish: () => this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/merchants/me/publish', body: {} }),
    unpublish: () => this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/merchants/me/unpublish', body: {} }),
    list: () => this.request<{ merchants: unknown[] }>({ method: 'GET', path: '/api/v1/merchants' }),
    getBySlug: (slug: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/merchants/${slug}` }),
  };

  creatorProfile = {
    me: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/creator-profile/me' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/creator-profile', body: input }),
    updateMe: (patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: '/api/v1/creator-profile/me', body: patch }),
  };

  affiliatorProfile = {
    me: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/affiliator-profile/me' }),
    create: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/affiliator-profile', body: input }),
    updateMe: (patch: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'PATCH', path: '/api/v1/affiliator-profile/me', body: patch }),
  };

  marketplace = {
    listCreators: (params: Record<string, unknown> = {}) =>
      this.request<{ creators: unknown[] }>({ method: 'GET', path: `/api/v1/marketplace/creators${qs(params)}` }),
    getCreator: (handle: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/marketplace/creators/${encodeURIComponent(handle)}` }),
    listCampaigns: (params: Record<string, unknown> = {}) =>
      this.request<{ campaigns: unknown[] }>({ method: 'GET', path: `/api/v1/marketplace/campaigns${qs(params)}` }),
    getCampaign: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'GET', path: `/api/v1/marketplace/campaigns/${id}` }),
    applyToCampaign: (id: string, input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/marketplace/campaigns/${id}/apply`, body: input }),
    myInvitations: () =>
      this.request<{ invitations: unknown[] }>({ method: 'GET', path: '/api/v1/marketplace/me/invitations' }),
    respondToInvitation: (invitationId: string, input: { accept: boolean }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/marketplace/me/invitations/${invitationId}/respond`, body: input }),
    myApplications: () =>
      this.request<{ applications: unknown[] }>({ method: 'GET', path: '/api/v1/marketplace/me/applications' }),
    // Short aliases (v0.2.1).
    apply: (id: string, input: Record<string, unknown>) => this.marketplace.applyToCampaign(id, input),
    creators: (params: Record<string, unknown> = {}) => this.marketplace.listCreators(params),
    creator: (handle: string) => this.marketplace.getCreator(handle),
    campaigns: (params: Record<string, unknown> = {}) => this.marketplace.listCampaigns(params),
    campaign: (id: string) => this.marketplace.getCampaign(id),
    invitations: () => this.marketplace.myInvitations(),
    respondInvitation: (invitationId: string, input: { accept: boolean }) =>
      this.marketplace.respondToInvitation(invitationId, input),
  };

  affiliates = {
    /** The public affiliator directory. The collection lives at
     *  `/affiliates/affiliators` — the router has no root route, so the
     *  old `/api/v1/affiliates` path 404'd — and it answers
     *  `{ data, cursor, hasMore }`. */
    list: (params: { limit?: number; cursor?: string; channel?: string; country?: string } = {}) =>
      this.request<{ data: unknown[]; cursor: string | null; hasMore: boolean }>({ method: 'GET', path: `/api/v1/affiliates/affiliators${qs(params)}` }),
  };

  kyc = {
    getStatus: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/kyc' }),
    submit: (input: Record<string, unknown>) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: '/api/v1/kyc', body: input }),
  };

  creatorStats = {
    overview: () => this.request<Record<string, unknown>>({ method: 'GET', path: '/api/v1/creator-stats' }),
    connect: (provider: string) =>
      this.request<{ url: string }>({ method: 'GET', path: `/api/v1/creator-stats/connect/${provider}` }),
  };

  // ─── Admin (Pattern 2 partner billing + KYC + disputes) ────
  admin = {
    provisionWorkspace: (input: {
      accountId: string;
      partner: 'storlaunch' | 'serront' | 'malapos';
      discountRate: number;
      brandName?: string;
      businessEmail?: string;
    }) =>
      this.request<PartnerWorkspace>({ method: 'POST', path: '/api/v1/admin/workspaces', body: input }),
    getWorkspace: (accountId: string) =>
      this.request<PartnerWorkspace>({ method: 'GET', path: `/api/v1/admin/workspaces/${accountId}` }),
    partnerUsage: (params: { partner?: string; from: string; to: string }) =>
      this.request<PartnerUsageSummary>({ method: 'GET', path: `/api/v1/admin/partner/usage${qs(params)}` }),

    // KYC moderation
    listKyc: (params: { status?: string; limit?: number } = {}) =>
      this.request<{ submissions: unknown[] }>({ method: 'GET', path: `/api/v1/admin/kyc${qs(params)}` }),
    approveKyc: (id: string) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/admin/kyc/${id}/approve`, body: {} }),
    rejectKyc: (id: string, input: { reason: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/admin/kyc/${id}/reject`, body: input }),

    // Disputes
    listDisputes: (params: { status?: string; limit?: number } = {}) =>
      this.request<{ disputes: unknown[] }>({ method: 'GET', path: `/api/v1/admin/disputes${qs(params)}` }),
    resolveDispute: (id: string, input: { resolution: 'merchant' | 'creator'; note?: string }) =>
      this.request<Record<string, unknown>>({ method: 'POST', path: `/api/v1/admin/disputes/${id}/resolve`, body: input }),
  };
}
