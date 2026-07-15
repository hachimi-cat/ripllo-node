export { RiplloClient } from './client.js';
export type { RiplloClientOptions } from './client.js';
export { verifyWebhook } from './webhooks.js';
export * from './types.js';

// Explicit re-exports for input shapes that live in client.ts (not
// types.ts) and therefore aren't covered by `export * from './types'`.
// The ripllo CLI worked around this with `Parameters<RiplloClient[x][y]>[0]`
// before 0.2.2 — keep these so downstream consumers can import the
// types directly.
export type {
  DiscountCodeCreateInput,
  BlogPostInput,
  ReferralProgramInput,
  LoyaltyProgramInput,
  MarketingCampaignCreateInput,
  MarketingCampaignUpdateInput,
  MarketingCampaignListParams,
} from './client.js';
