# Changelog

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
