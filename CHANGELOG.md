# Changelog

## 0.6.0
- A route read by id next to its list is named `get` + the list's name: `client.api.affiliatesGetAffiliators` (was `client.api.affiliatesAffiliators2`), `client.api.affiliatesGetPrograms` (was `client.api.affiliatesPrograms2`), `client.api.blogGetPublic` (was `client.api.blogPublic`), `client.api.blogGetPublic2` (was `client.api.blogPublic2`), `client.api.inboxGetThreads` (was `client.api.inboxThreads2`), `client.api.marketplaceGetCampaigns` (was `client.api.marketplaceCampaigns2`), `client.api.marketplaceGetCreators` (was `client.api.marketplaceCreators2`). Each old name stays as a deprecated alias.
- Query fields the API refuses a request without are now required: `code` on GET /api/v1/creator-stats/connect/{platform}/callback, `state` on GET /api/v1/creator-stats/connect/{platform}/callback, `key` on GET /api/v1/uploads/avatar, `id` on GET /api/v1/uploads/deliverable, `key` on GET /api/v1/uploads/merchant-asset.

## 0.5.2

- `client.api` regenerated from the API spec: 208 routes (operator-only platform sweeps
  and the e2e helpers are no longer part of the public surface).
- Signatures: the API now accepts a request signed over the exact bytes sent, so bodies
  with non-ASCII text, floats like `1.0` or an empty `{}` no longer fail with
  `BAD_SIGNATURE` (server fix; this SDK already signed what it sent).

## 0.5.0

Corrects typed methods that pointed at routes the backend never served, or
sent bodies the API rejects. These are breaking type changes, but the
methods they replace could not succeed at runtime.

- `affiliates.list()` targeted `GET /api/v1/affiliates`. The router mounts
  `/affiliators`, `/programs` and `/me/*` and has no root route, so the
  call was a permanent 404. Now `GET /api/v1/affiliates/affiliators`,
  returning `{ data, cursor, hasMore }` (was typed `{ affiliates,
  nextCursor }`), and it accepts `channel` / `country` filters.
- `uploads.sign()` / `uploads.signMerchant()` sent `{ filename,
  contentType }`. The route takes a `kind` enum (`kyc-id`, `kyc-selfie`,
  `profile-avatar`, `deliverable-asset`, `compose-asset`, `merchant-logo`)
  and generates the key server-side, so every call 400'd. Responses also
  carry `contentType` and `expiresIn`.
- `collaborations.uploadDeliverableKey()` sent `{ filename, contentType }`;
  the route takes `{ originalKey }` — the key of an already-uploaded
  object. Get it from `uploads.sign({ kind: 'deliverable-asset' })`.
- `collaborations.rejectDeliverable()` sent `{ reason }`; the route reads
  `{ notes }`, so rejection reasons were silently discarded. The
  `collaborations.deliverables.*` short aliases carried the same shapes.
- `apiKeys.create()` requires `name` and returns `{ apiKey, secret }` —
  the secret appears on that response only. `apiKeys.list()` returns
  `{ apiKeys }`, `apiKeys.revoke()` returns `{ apiKey }`.

## 0.4.1
- Package metadata now points at the public mirror repo (github.com/hachimi-cat/ripllo-node).

## 0.4.0
- Prior release.
