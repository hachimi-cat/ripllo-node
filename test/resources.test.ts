import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RiplloClient } from '../src/index.js';

function makeClient() {
  const captured: Array<{ url: string; method: string; body?: string }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: typeof input === 'string' ? input : input.toString(),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(
      JSON.stringify({ data: { ok: true }, error: null, meta: { requestId: 'r', timestamp: '' } }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  const client = new RiplloClient({ keyId: 'ak', secret: 'sk', baseUrl: 'https://ripllo.test' });
  return { client, captured, restore: () => { globalThis.fetch = realFetch; } };
}

describe('v0.2.0 expansion', () => {
  let h: ReturnType<typeof makeClient>;
  beforeEach(() => { h = makeClient(); });
  afterEach(() => h.restore());

  it('apiKeys.create POSTs', async () => {
    await h.client.apiKeys.create({ description: 'CI' });
    expect(h.captured[0]!.url).toContain('/api/v1/api-keys');
    expect(h.captured[0]!.method).toBe('POST');
  });
  it('webhooks.listEndpoints GETs', async () => {
    await h.client.webhooks.listEndpoints();
    expect(h.captured[0]!.url).toContain('/api/v1/webhooks/endpoints');
  });
  it('billing.checkout POSTs', async () => {
    await h.client.billing.checkout({ planId: 'pro' });
    expect(h.captured[0]!.url).toContain('/api/v1/billing/checkout');
  });
  it('campaigns.acceptApplication POSTs', async () => {
    await h.client.campaigns.acceptApplication('c1', 'a1');
    expect(h.captured[0]!.url).toContain('/api/v1/campaigns/c1/applications/a1/accept');
  });
  it('programs.approveEnrollment POSTs', async () => {
    await h.client.programs.approveEnrollment('p1', 'e1');
    expect(h.captured[0]!.url).toContain('/api/v1/programs/p1/enrollments/e1/approve');
  });
  it('collaborations.publishDeliverable POSTs', async () => {
    await h.client.collaborations.publishDeliverable('co1', 'd1');
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/deliverables/d1/published');
  });
  it('channels.test POSTs', async () => {
    await h.client.channels.test('ch1');
    expect(h.captured[0]!.url).toContain('/api/v1/channels/ch1/test');
  });
  it('contacts.import POSTs', async () => {
    await h.client.contacts.import({ rows: [] });
    expect(h.captured[0]!.url).toContain('/api/v1/contacts/import');
  });
  it('contactLists.removeMember DELETEs', async () => {
    await h.client.contactLists.removeMember('l1', 'c1');
    expect(h.captured[0]!.method).toBe('DELETE');
    expect(h.captured[0]!.url).toContain('/api/v1/contact-lists/l1/members/c1');
  });
  it('broadcasts.compileTemplate POSTs to /broadcasts/templates/compile', async () => {
    await h.client.broadcasts.compileTemplate({ template: 'X' });
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts/templates/compile');
  });
  it('broadcasts.list GETs /broadcasts (not /marketing-campaigns)', async () => {
    await h.client.broadcasts.list();
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts');
    expect(h.captured[0]!.url).not.toContain('/api/v1/marketing-campaigns');
  });
  it('marketingCampaigns is now a SEPARATE resource (hub), not an alias of broadcasts', () => {
    expect(h.client.marketingCampaigns).not.toBe(h.client.broadcasts);
  });
  it('marketingCampaigns.list GETs /api/v1/marketing-campaigns', async () => {
    await h.client.marketingCampaigns.list();
    expect(h.captured[0]!.method).toBe('GET');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns');
  });
  it('marketingCampaigns.list serializes status array as comma-joined query', async () => {
    await h.client.marketingCampaigns.list({ status: ['draft', 'live'] });
    expect(h.captured[0]!.url).toMatch(/status=draft%2Clive/);
  });
  it('marketingCampaigns.get GETs /api/v1/marketing-campaigns/:id (no /full)', async () => {
    await h.client.marketingCampaigns.get('mc_abc');
    expect(h.captured[0]!.method).toBe('GET');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns/mc_abc');
    expect(h.captured[0]!.url).not.toContain('/full');
  });
  it('marketingCampaigns.getFull GETs /api/v1/marketing-campaigns/:id/full', async () => {
    await h.client.marketingCampaigns.getFull('mc_abc');
    expect(h.captured[0]!.method).toBe('GET');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns/mc_abc/full');
  });
  it('marketingCampaigns.selector GETs /api/v1/marketing-campaigns/_/selector', async () => {
    await h.client.marketingCampaigns.selector();
    expect(h.captured[0]!.method).toBe('GET');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns/_/selector');
  });
  it('marketingCampaigns.create POSTs body with idempotency key', async () => {
    await h.client.marketingCampaigns.create({ name: 'Q3 Push', goal: 'conversion' });
    expect(h.captured[0]!.method).toBe('POST');
    expect(h.captured[0]!.url).toMatch(/\/api\/v1\/marketing-campaigns$/);
    const body = JSON.parse(h.captured[0]!.body!);
    expect(body).toEqual({ name: 'Q3 Push', goal: 'conversion' });
  });
  it('marketingCampaigns.update PATCHes /api/v1/marketing-campaigns/:id', async () => {
    await h.client.marketingCampaigns.update('mc_abc', { status: 'live' });
    expect(h.captured[0]!.method).toBe('PATCH');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns/mc_abc');
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ status: 'live' });
  });
  it('marketingCampaigns.delete DELETEs /api/v1/marketing-campaigns/:id', async () => {
    await h.client.marketingCampaigns.delete('mc_abc');
    expect(h.captured[0]!.method).toBe('DELETE');
    expect(h.captured[0]!.url).toContain('/api/v1/marketing-campaigns/mc_abc');
  });
  it('funnels.setSteps PUTs', async () => {
    await h.client.funnels.setSteps('f1', { steps: [] });
    expect(h.captured[0]!.method).toBe('PUT');
    expect(h.captured[0]!.url).toContain('/api/v1/funnels/f1/steps');
  });
  it('inbox.archive POSTs', async () => {
    await h.client.inbox.archive('t1');
    expect(h.captured[0]!.url).toContain('/api/v1/inbox/t1/archive');
  });
  it('audienceSegments.previewAdhoc POSTs', async () => {
    await h.client.audienceSegments.previewAdhoc({ filter: {} });
    expect(h.captured[0]!.url).toContain('/api/v1/audience-segments/preview');
  });
  it('merchantProfile.publish POSTs', async () => {
    await h.client.merchantProfile.publish();
    expect(h.captured[0]!.url).toContain('/api/v1/merchants/me/publish');
  });
  it('marketplace.applyToCampaign POSTs', async () => {
    await h.client.marketplace.applyToCampaign('c1', { pitch: 'hi' });
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/campaigns/c1/apply');
  });
  it('admin.rejectKyc POSTs with body', async () => {
    await h.client.admin.rejectKyc('k1', { reason: 'bad photo' });
    expect(h.captured[0]!.url).toContain('/api/v1/admin/kyc/k1/reject');
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ reason: 'bad photo' });
  });
  it('admin.resolveDispute POSTs', async () => {
    await h.client.admin.resolveDispute('d1', { resolution: 'merchant' });
    expect(h.captured[0]!.url).toContain('/api/v1/admin/disputes/d1/resolve');
  });
  it('existing discountCodes.list still works', async () => {
    await h.client.discountCodes.list();
    expect(h.captured[0]!.url).toContain('/api/v1/discount-codes');
  });
  it('existing passthrough still works', async () => {
    await h.client.passthrough('GET', '/api/v1/custom/route');
    expect(h.captured[0]!.url).toContain('/api/v1/custom/route');
  });
});

describe('v0.2.1 short aliases', () => {
  let h: ReturnType<typeof makeClient>;
  beforeEach(() => { h = makeClient(); });
  afterEach(() => h.restore());

  // programs aliases
  it('programs.approve delegates to approveEnrollment', async () => {
    await h.client.programs.approve('p1', 'e1');
    expect(h.captured[0]!.url).toContain('/api/v1/programs/p1/enrollments/e1/approve');
    expect(h.captured[0]!.method).toBe('POST');
  });
  it('programs.reject delegates to rejectEnrollment', async () => {
    await h.client.programs.reject('p1', 'e1');
    expect(h.captured[0]!.url).toContain('/api/v1/programs/p1/enrollments/e1/reject');
  });
  it('programs.revoke delegates to revokeEnrollment', async () => {
    await h.client.programs.revoke('p1', 'e1');
    expect(h.captured[0]!.url).toContain('/api/v1/programs/p1/enrollments/e1/revoke');
  });
  it('programs.enrollments delegates to listEnrollments', async () => {
    await h.client.programs.enrollments('p1');
    expect(h.captured[0]!.url).toContain('/api/v1/programs/p1/enrollments');
    expect(h.captured[0]!.method).toBe('GET');
  });

  // marketplace aliases
  it('marketplace.apply delegates to applyToCampaign', async () => {
    await h.client.marketplace.apply('c1', { pitch: 'hi' });
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/campaigns/c1/apply');
    expect(h.captured[0]!.method).toBe('POST');
  });
  it('marketplace.creators delegates to listCreators', async () => {
    await h.client.marketplace.creators({ q: 'foo' });
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/creators');
    expect(h.captured[0]!.url).toContain('q=foo');
  });
  it('marketplace.creator delegates to getCreator', async () => {
    await h.client.marketplace.creator('alice');
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/creators/alice');
  });
  it('marketplace.campaigns delegates to listCampaigns', async () => {
    await h.client.marketplace.campaigns();
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/campaigns');
  });
  it('marketplace.campaign delegates to getCampaign', async () => {
    await h.client.marketplace.campaign('cmp1');
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/campaigns/cmp1');
  });
  it('marketplace.invitations delegates to myInvitations', async () => {
    await h.client.marketplace.invitations();
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/me/invitations');
  });
  it('marketplace.respondInvitation delegates to respondToInvitation', async () => {
    await h.client.marketplace.respondInvitation('i1', { accept: true });
    expect(h.captured[0]!.url).toContain('/api/v1/marketplace/me/invitations/i1/respond');
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ accept: true });
  });

  // channels alias
  it('channels.dns delegates to dnsRecords', async () => {
    await h.client.channels.dns('ch1');
    expect(h.captured[0]!.url).toContain('/api/v1/channels/ch1/dns-records');
  });

  // collaborations aliases
  it('collaborations.approve delegates to approveCollaboration', async () => {
    await h.client.collaborations.approve('co1');
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/approve');
  });
  it('collaborations.cancel delegates to cancelCollaboration', async () => {
    await h.client.collaborations.cancel('co1');
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/cancel');
  });
  it('collaborations.deliverables.approve delegates', async () => {
    await h.client.collaborations.deliverables.approve('co1', 'd1');
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/deliverables/d1/approve');
  });
  it('collaborations.deliverables.reject delegates with body', async () => {
    await h.client.collaborations.deliverables.reject('co1', 'd1', { reason: 'blurry' });
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/deliverables/d1/reject');
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ reason: 'blurry' });
  });
  it('collaborations.deliverables.publish delegates', async () => {
    await h.client.collaborations.deliverables.publish('co1', 'd1');
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/deliverables/d1/published');
  });
  it('collaborations.deliverables.uploadKey delegates', async () => {
    await h.client.collaborations.deliverables.uploadKey('co1', 'd1', { filename: 'a.png', contentType: 'image/png' });
    expect(h.captured[0]!.url).toContain('/api/v1/collaborations/co1/deliverables/d1/upload-key');
  });

  // broadcasts.templates nested accessor (legacy URL kept)
  it('broadcasts.templates.list delegates to listTemplates', async () => {
    await h.client.broadcasts.templates.list();
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts/templates');
    expect(h.captured[0]!.method).toBe('GET');
  });
  it('broadcasts.templates.create delegates to createTemplate', async () => {
    await h.client.broadcasts.templates.create({ name: 'T' });
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts/templates');
    expect(h.captured[0]!.method).toBe('POST');
  });
  it('broadcasts.templates.update delegates to updateTemplate', async () => {
    await h.client.broadcasts.templates.update('t1', { name: 'T2' });
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts/templates/t1');
    expect(h.captured[0]!.method).toBe('PATCH');
  });
  it('broadcasts.templates.compile delegates to compileTemplate', async () => {
    await h.client.broadcasts.templates.compile({ template: 'X' });
    expect(h.captured[0]!.url).toContain('/api/v1/broadcasts/templates/compile');
    expect(h.captured[0]!.method).toBe('POST');
  });

  // funnels.setSteps overload
  it('funnels.setSteps accepts bare array (v0.2.1 overload)', async () => {
    await h.client.funnels.setSteps('f1', [{ kind: 'email' }]);
    expect(h.captured[0]!.method).toBe('PUT');
    expect(h.captured[0]!.url).toContain('/api/v1/funnels/f1/steps');
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ steps: [{ kind: 'email' }] });
  });
  it('funnels.setSteps still accepts { steps: [...] } object', async () => {
    await h.client.funnels.setSteps('f1', { steps: [{ kind: 'email' }] });
    expect(JSON.parse(h.captured[0]!.body!)).toEqual({ steps: [{ kind: 'email' }] });
  });
});
