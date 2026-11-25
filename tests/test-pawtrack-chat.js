const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = stripTypeScriptTypes(fs.readFileSync(
  path.join(__dirname, '../supabase/functions/pawtrack-chat/index.ts'), 'utf8'
));
const primary = 'gemini-flash-latest';
const backup = 'gemini-3.1-flash-lite';
const userTurn = { role: 'user', text: 'How do I link an NFC tag?' };
const petId = '77777777-7777-4777-8777-777777777777';
const reportId = '11111111-1111-4111-8111-111111111111';
const pet = { id: petId, name: 'Milo', status: 'safe', species: 'Dog' };
const report = { id: reportId, pet_id: petId, pet_name: 'Milo', status: 'missing' };

function setup(generate, records = {}) {
  const calls = [];
  const reads = [];
  let serve;
  const env = {
    SUPABASE_URL: 'https://pawtrack.test',
    SUPABASE_ANON_KEY: 'anon',
    GEMINI_API_KEY: 'test-secret',
  };
  vm.runInNewContext(source, {
    Deno: { env: { get: (key) => env[key] }, serve: (handler) => { serve = handler; } },
    Response, Headers, URL, URLSearchParams, TextDecoder, TextEncoder, ReadableStream, AbortController, AbortSignal, console,
    async fetch(url, options) {
      const parsed = new URL(url);
      if (parsed.pathname === '/auth/v1/user') {
        return options.headers.Authorization === 'Bearer valid'
          ? Response.json({ id: 'test-guardian' })
          : Response.json({}, { status: 401 });
      }
      if (parsed.pathname.startsWith('/rest/v1/')) {
        assert.equal(options.method, undefined, 'Assistant tools only read records');
        assert.equal(options.headers.Authorization, 'Bearer valid');
        const table = parsed.pathname.split('/').at(-1);
        const filters = Object.fromEntries(parsed.searchParams);
        reads.push({ table, filters });
        const rows = records[table];
        return Response.json(typeof rows === 'function' ? await rows(options.signal) : rows ?? []);
      }
      assert.equal(options.headers['x-goog-api-key'], 'test-secret');
      if (parsed.pathname === '/v1beta/models') {
        return Response.json({ models: [backup, 'gemini-9-flash-image'].map(name => ({
          name: `models/${name}`, supportedGenerationMethods: ['generateContent'],
        })) });
      }
      const model = parsed.pathname.split('/').at(-1).split(':')[0];
      const request = JSON.parse(options.body);
      calls.push({ model, contents: request.contents, tools: request.tools });
      return generate(model, request);
    },
  });
  const request = (messages, token = 'valid', stream = false, audience) => serve(new Request('https://pawtrack.test/chat', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, ...(stream ? { Accept: 'text/event-stream' } : {}) },
    body: JSON.stringify({ messages, audience }),
  }));
  return { calls, reads, request };
}

function functionCall(name, args) {
  return Response.json({ candidates: [{ content: { role: 'model', parts: [
    { functionCall: { name, args, id: 'call-1' }, thoughtSignature: 'gemini-signature' },
  ] } }] });
}

function answer(text) {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

async function readEvent(reader) {
  const { done, value } = await reader.read();
  assert.equal(done, false);
  return JSON.parse(new TextDecoder().decode(value).trim().slice('data: '.length));
}

function quota() {
  return Response.json({ error: { status: 'RESOURCE_EXHAUSTED' } }, {
    status: 429, headers: { 'Retry-After': '60' },
  });
}

async function run() {
  const { calls, request } = setup((model) => {
    if (model === primary) return quota();
    assert.equal(model, backup);
    return Response.json({ candidates: [{ content: { parts: [
      { text: 'internal reasoning', thought: true }, { text: 'Open your pet profile to link a tag.' },
    ] } }] });
  });

  assert.equal((await request([userTurn], 'invalid')).status, 401);
  assert.equal((await request([userTurn, userTurn])).status, 400);
  assert.equal((await request([userTurn], 'valid', false, 'unknown')).status, 400);
  assert.equal(calls.length, 0);

  const adminQuestion = [{ role: 'user', text: 'How do I record an intake?' }];
  const unauthorizedAdmin = setup(() => assert.fail('Admin access must be checked before calling Gemini'));
  const rejectedAdmin = await unauthorizedAdmin.request(adminQuestion, 'valid', true, 'admin');
  assert.equal(rejectedAdmin.status, 403);
  assert.equal((await rejectedAdmin.json()).code, 'sign_in');
  assert.deepEqual(unauthorizedAdmin.reads, [{ table: 'admin_accounts', filters: {
    select: 'id', id: 'eq.test-guardian', status: 'eq.approved', limit: '1',
  } }]);

  const account = { admin_accounts: [{ id: 'test-guardian' }] };
  const admin = setup((_, payload) => {
    assert.match(payload.systemInstruction.parts[0].text, /Impoundments: Select Scan & intake/);
    assert.equal(payload.tools, undefined);
    assert.equal(payload.toolConfig, undefined);
    return answer('Open Impoundments and select Scan & intake.');
  }, account);
  const adminReader = (await admin.request(adminQuestion, 'valid', true, 'admin')).body.getReader();
  assert.equal((await readEvent(adminReader)).stage, 'reading_request');
  assert.equal((await readEvent(adminReader)).data.reply, 'Open Impoundments and select Scan & intake.');
  assert.equal((await adminReader.read()).done, true);
  assert.deepEqual(admin.reads.map(read => read.table), ['admin_accounts']);

  const unexpectedAdminCall = setup(() => functionCall('list_my_pets', {}), account);
  const rejectedCall = await unexpectedAdminCall.request(adminQuestion, 'valid', false, 'admin');
  assert.equal((await rejectedCall.json()).code, 'unavailable');
  assert.deepEqual(unexpectedAdminCall.reads.map(read => read.table), ['admin_accounts']);

  const result = await request([userTurn]);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { reply: 'Open your pet profile to link a tag.', model: backup });
  assert.deepEqual(calls.map(call => call.model), [primary, backup]);
  assert.deepEqual(calls[0].contents, calls[1].contents);

  const followup = [
    userTurn,
    { role: 'model', text: 'Open your pet profile to link a tag.' },
    { role: 'user', text: 'What if my tag is already linked?' },
  ];
  assert.equal((await request(followup)).status, 200);
  assert.deepEqual(calls.map(call => call.model), [primary, backup, backup]);
  assert.deepEqual(calls[2].contents, followup.map(({ role, text }) => ({ role, parts: [{ text }] })));

  const exhausted = setup(quota);
  const limit = await exhausted.request([userTurn]);
  assert.equal(limit.status, 429);
  assert.equal((await limit.json()).code, 'quota');

  const blocked = setup(() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }));
  assert.equal((await blocked.request([userTurn])).status, 422);
  assert.deepEqual(blocked.calls.map(call => call.model), [primary]);

  const agent = setup((model, { contents }) => {
    if (contents.length === 1) return functionCall('get_report_sightings', { reportId });
    assert.equal(contents[1].parts[0].thoughtSignature, 'gemini-signature');
    assert.equal(contents[2].role, 'user');
    const result = contents[2].parts[0].functionResponse;
    assert.equal(result.id, 'call-1');
    assert.equal(result.response.sightings.length, 1);
    return model === primary ? quota() : answer('One possible sighting near the park.');
  }, { missing_pets: [report], community_sightings: [{ location: 'The park', status: 'possible_sighting' }] });
  const agentResult = await (await agent.request([{ role: 'user', text: 'Has anyone seen Milo?' }])).json();
  assert.equal(agentResult.model, backup);
  assert.deepEqual(agent.calls.map(call => call.model), [primary, primary, backup, backup]);
  assert.deepEqual(agent.calls[2].contents, agent.calls[0].contents, 'Backup starts with the original history');
  assert.equal(agent.reads[0].filters.reporter_id, 'eq.test-guardian');
  assert.equal(agent.reads[1].filters.missing_pet_id, `eq.${reportId}`);
  assert.equal(agent.reads[1].filters.select, 'location,seen_at,status');

  const denied = setup((_, { contents }) => contents.length === 1
    ? functionCall('get_report_sightings', { reportId }) : answer('No active report matches.'));
  await denied.request([userTurn]);
  assert.deepEqual(denied.reads.map(read => read.table), ['missing_pets'], 'No sighting read for a report outside the guardian scope');

  const draft = setup(() => functionCall('prepare_missing_report', {
    petId, location: 'Barangay Hall', lastSeenAt: '2026-11-25T14:30', condition: 'Red collar',
  }), { registered_pets: [pet] });
  const proposal = await (await draft.request([userTurn])).json();
  assert.deepEqual(proposal.action, { kind: 'missing', petId, petName: 'Milo', location: 'Barangay Hall',
    lastSeenAt: '2026-11-25T14:30', condition: 'Red collar', description: '' });
  assert.equal(draft.reads[0].filters.owner_id, 'eq.test-guardian');

  const reunion = setup(() => functionCall('prepare_mark_found', { reportId, condition: 'Safe' }), { missing_pets: [report] });
  const reunionPreview = await (await reunion.request([userTurn])).json();
  assert.equal(reunionPreview.action.reportId, reportId);
  assert.equal(reunionPreview.action.condition, 'Safe');
  assert.equal(reunion.reads[0].filters.reporter_id, 'eq.test-guardian');

  const unknown = setup((_, { contents }) => contents.length === 1
    ? functionCall('delete_my_pets', {}) : answer('This action is unavailable.'));
  await unknown.request([userTurn]);
  assert.equal(unknown.reads.length, 0);

  const sightingLoad = Promise.withResolvers();
  const live = setup((_, { contents }) => contents.length === 1
    ? functionCall('get_report_sightings', { reportId }) : answer('I found a possible sighting.'), {
    missing_pets: [report], community_sightings: () => sightingLoad.promise,
  });
  const liveResponse = await live.request([userTurn], 'valid', true);
  assert.match(liveResponse.headers.get('Content-Type'), /^text\/event-stream/);
  const reader = liveResponse.body.getReader();
  assert.equal((await readEvent(reader)).stage, 'reading_request');
  assert.equal((await readEvent(reader)).stage, 'checking_reports');
  assert.deepEqual(await readEvent(reader), { type: 'progress', stage: 'checking_sightings', petName: 'Milo' });
  // The named status arrives while the sightings request is still pending.
  sightingLoad.resolve([{ location: 'The park' }]);
  assert.equal((await readEvent(reader)).stage, 'writing_reply');
  assert.equal((await readEvent(reader)).data.reply, 'I found a possible sighting.');
  assert.equal((await reader.read()).done, true);

  const quotaStream = await setup(quota).request([userTurn], 'valid', true);
  const quotaReader = quotaStream.body.getReader();
  assert.equal((await readEvent(quotaReader)).stage, 'reading_request');
  assert.equal((await readEvent(quotaReader)).stage, 'switching_model');
  assert.equal((await readEvent(quotaReader)).data.code, 'quota');

  const interrupted = Promise.withResolvers();
  const cancellable = setup(() => functionCall('list_my_pets', {}), {
    registered_pets: (signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => { interrupted.resolve(); reject(signal.reason); }, { once: true });
    }),
  });
  const cancelledReader = (await cancellable.request([userTurn], 'valid', true)).body.getReader();
  await readEvent(cancelledReader);
  assert.equal((await readEvent(cancelledReader)).stage, 'checking_pets');
  await cancelledReader.cancel();
  await interrupted.promise;
  console.log('PawTrack chat passed authentication, tool scoping, draft, thought signature, quota fallback, and safety checks.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
