import { describe, it, expect, afterEach } from 'vitest';
import { RiplloClient } from '../src/index.js';

// client.api: every feature route, generated from the API spec (scripts/apigen.sh).
describe('client.api (generated from the spec)', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function capture() {
    const seen: Array<{ url: string; method: string; body?: string; auth?: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
        auth: new Headers(init?.headers).get('authorization'),
      });
      return new Response(JSON.stringify({ data: { ok: true }, error: null, meta: { requestId: 'r', timestamp: '' } }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    return seen;
  }

  it('creates a discount code with the fields Ripllo validates, signed', async () => {
    const seen = capture();
    const client = new RiplloClient({ keyId: 'AKIARPLOTEST', secret: 'sk', baseUrl: 'https://ripllo.test' });
    await client.api.discountCodesCreate({ code: 'SPRING10', type: 'percent', value: 10, currency: 'IDR', public: false });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://ripllo.test/api/v1/discount-codes');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ code: 'SPRING10', type: 'percent', value: 10, currency: 'IDR', public: false });
    expect(seen[0]!.auth).toMatch(/^Ripllo-HMAC-SHA256 keyId=AKIARPLOTEST/);
  });

  it('puts path parameters in the path and query fields in the query', async () => {
    const seen = capture();
    const client = new RiplloClient({ keyId: 'ak', secret: 'sk', baseUrl: 'https://ripllo.test' });
    await client.api.discountCodesGet('dc 1');
    await client.api.discountCodesList({ limit: 5, active: true });
    expect(seen[0]!.url).toBe('https://ripllo.test/api/v1/discount-codes/dc%201');
    const listed = new URL(seen[1]!.url);
    expect(listed.pathname).toBe('/api/v1/discount-codes');
    expect(Object.fromEntries(listed.searchParams)).toEqual({ limit: '5', active: 'true' });
  });
});
