'use strict';
// Opt-in DEVELOPMENT integration test. Importing this file performs no I/O.
// Adapted from the exercised duoly-order-ui-live.cjs: real GoTrue admin fixtures,
// password SDK sessions + SSR cookies, browser order controls, owner SQL cleanup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const REF = 'omnejesspybaxuacjlah';
const SUPA = `https://${REF}.supabase.co`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BYTES = 1572864;
function insist(value) { if (!value) throw new Error('CHECK_FAILED'); }
function uuid(value) { insist(typeof value === 'string' && UUID.test(value)); return value; }
function proofPath(binding) { return [binding.order_id, binding.assignment_id, binding.id].map(uuid).join('/'); }
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    insist(['--project-ref', '--allow-development-fixtures', '--root'].includes(flag) && !Object.hasOwn(out, flag));
    out[flag] = flag === '--allow-development-fixtures' ? true : args[++i];
  }
  insist(out['--project-ref'] === REF && out['--allow-development-fixtures'] === true);
  const root = out['--root'];
  insist(typeof root === 'string' && path.isAbsolute(root) && root !== path.parse(root).root && path.normalize(root) === root && !root.includes('\0'));
  return { projectRef: REF, root };
}
function isolatedEnv(base = process.env) {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter(k => base[k]).map(k => [k, base[k]]));
}
function absentStorage(status, body) {
  return status === 404 || (status === 400 && body?.statusCode === '404' && body?.error === 'not_found');
}
function fixtureEmail(index, marker) { uuid(marker); insist(Number.isInteger(index) && index >= 0 && index < 4); return `duoly-proof-${index}-${marker}@example.invalid`; }
function assertFixtureUser(current, id, marker) {
  uuid(id); uuid(marker);
  insist(current?.id === id && current.user_metadata?.duoly_proof_owner === marker && [0, 1, 2, 3].some(i => current.email === fixtureEmail(i, marker)));
  return current;
}
function validateProof(proof, order, assignment) {
  insist(proof && Object.keys(proof).sort().join(',') === 'assignment_id,byte_size,created_at,id,mime,order_id');
  proofPath(proof);
  insist(proof.order_id === order && (!assignment || proof.assignment_id === assignment));
  insist(['image/png', 'image/jpeg', 'image/webp'].includes(proof.mime));
  insist(Number.isInteger(proof.byte_size) && proof.byte_size > 0 && proof.byte_size <= MAX_BYTES && Number.isFinite(Date.parse(proof.created_at)));
  return proof;
}
async function run(options) {
  const root = options.root;
  // Refuse symlinked/noncanonical roots and dotenv files: Astro otherwise reads
  // ambient project secrets despite a minimal child environment. No file is edited.
  insist(fs.realpathSync(root) === root);
  for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) insist(!fs.existsSync(path.join(root, file)));
  for (const file of ['package.json', 'src/contracts/proofs.ts', 'src/server/proofs/handlers.ts', 'supabase/migrations/20261022140000_order_proofs.sql']) insist(fs.statSync(path.join(root, file)).isFile());
  const targetRequire = createRequire(path.join(root, 'package.json'));
  const { chromium, expect } = targetRequire('@playwright/test');
  const { createServerClient } = targetRequire('@supabase/ssr');
  const cli = path.join(root, 'node_modules/.bin/supabase');
  insist(fs.existsSync(cli));
  const marker = crypto.randomUUID();
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const refs = ids.map(id => 'DL-' + BigInt('0x' + id.replaceAll('-', '')).toString());
  const note = `Synthetic proof fixture ${marker}; not paid`;
  const checks = [];
  const users = [];
  let key, pub, server, browser, origin, phase = 'keys', completed = false, interrupted = false;
  let pageErrors = 0;
  const cleanup = { browser_closed: false, server_closed: false, storage_absent: false, rows_absent: false, users_absent: false };
  const safe = (name) => { insist(!interrupted); checks.push(name); };
  const q = value => { insist(typeof value === 'string' && !value.includes("'")); return `'${value}'`; };
  function cliJSON(args) {
    try { return JSON.parse(execFileSync(cli, args, { cwd: root, env: isolatedEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 8 * 1024 * 1024 })); }
    catch { throw new Error('CLI_OPERATION_FAILED'); }
  }
  function sql(text) {
    const data = cliJSON(['db', 'query', '--linked', '--project-ref', REF, '--output', 'json', text]);
    const rows = Array.isArray(data) ? data : data.rows;
    insist(Array.isArray(rows)); return rows;
  }
  async function remote(url, init = {}) {
    return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(25000) });
  }
  async function admin(resource, method = 'GET', data) {
    const response = await remote(`${SUPA}/auth/v1/admin/${resource}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
    insist(response.ok);
    if (method === 'DELETE') { await response.arrayBuffer(); return; }
    const result = await response.json(); return result.user ?? result;
  }
  function discoverUsers() {
    return sql(`select id,email from auth.users where raw_user_meta_data->>'duoly_proof_owner'=${q(marker)} and email in (${[0,1,2,3].map(i => q(fixtureEmail(i, marker))).join(',')});`);
  }
  async function ownedUser(id) {
    uuid(id); const current = await admin('users/' + id);
    return assertFixtureUser(current, id, marker);
  }
  function ownedOrders() {
    return sql(`select id,customer_id,note from public.orders where id in (${ids.map(q).join(',')});`);
  }
  function assertOwnedOrders() {
    const rows = ownedOrders();
    for (const row of rows) insist(users.slice(0, 2).some(u => u.id === row.customer_id) && row.note === note);
    return rows;
  }
  function orderSQL(index, expired = false) {
    uuid(users[index].id);
    const time = expired ? "clock_timestamp()-interval '10 minutes'" : 'clock_timestamp()';
    return `insert into public.orders(id,public_reference,customer_id,game,service,title,units,unit,region,ign,note,customer_name,amount_eur_cents,booking_fx,payout_usd_cents,created_at,queued_at) values(${q(ids[index])},${q(refs[index])},${q(users[index].id)},'lol','duo','Synthetic proof fixture',1,'game','EUW','FixturePlayer',${q(note)},'Proof fixture customer',999,1.08,646,${time},${time});`;
  }
  const idsSQL = () => ids.map(q).join(',');
  const usersSQL = () => users.map(u => q(uuid(u.id))).join(',');
  function ownedProofs() {
    assertOwnedOrders();
    return sql(`select p.id,p.order_id,p.assignment_id from public.order_proof_uploads p join public.orders o on o.id=p.order_id where o.id in (${idsSQL()}) and o.customer_id in (${usersSQL()}) and o.note=${q(note)};`);
  }
  function objectCounts() {
    const proofs = ownedProofs();
    if (!proofs.length) return { proofs: 0, objects: 0 };
    const rows = sql(`select count(*)::int as count from storage.objects where bucket_id='order-proof' and name in (${proofs.map(p => q(proofPath(p))).join(',')});`);
    return { proofs: proofs.length, objects: Number(rows[0].count) };
  }
  async function storage(binding, method = 'GET') {
    const name = proofPath(binding);
    const response = await remote(`${SUPA}/storage/v1/object/${method === 'DELETE' ? 'order-proof' : 'authenticated/order-proof/' + name + '?proof_read=' + crypto.randomUUID()}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? JSON.stringify({ prefixes: [name] }) : undefined,
    });
    if (method === 'DELETE') { insist(response.ok); await response.arrayBuffer(); return; }
    if (response.ok) { await response.arrayBuffer(); return false; }
    let body; try { body = await response.json(); } catch { /* not evidence of absence */ }
    insist(absentStorage(response.status, body)); return true;
  }
  async function actor(user) {
    const jar = new Map();
    const client = createServerClient(SUPA, pub, { cookieOptions: { name: 'duoly-session', httpOnly: true, secure: false, sameSite: 'lax', path: '/' }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cs => cs.forEach(c => jar.set(c.name, c.value)) } });
    const auth = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    insist(!auth.error && auth.data.session);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: origin, httpOnly: true, secure: false, sameSite: 'Lax' })));
    const page = await context.newPage();
    context.on('page', p => p.on('pageerror', () => pageErrors++));
    page.on('pageerror', () => pageErrors++);
    return { context, page, token: auth.data.session.access_token, client };
  }
  async function list(actor, order) {
    const response = await actor.context.request.get(`${origin}/api/orders/${uuid(order)}/proof`);
    insist(response.status() === 200 && response.headers()['cache-control']?.includes('no-store'));
    const data = await response.json(); insist(Object.keys(data).join(',') === 'proofs' && Array.isArray(data.proofs));
    data.proofs.forEach(p => validateProof(p, order)); return data.proofs;
  }
  async function open(actor, proof, expected = 200, order = proof.order_id) {
    const response = await actor.context.request.get(`${origin}/api/orders/${uuid(order)}/proof/${uuid(proof.id)}`);
    insist(response.status() === expected);
    insist(response.headers()['cache-control']?.includes('no-store'));
    if (expected === 200) {
      insist(response.headers()['content-type'] === proof.mime && response.headers()['x-content-type-options'] === 'nosniff');
      insist((await response.body()).length === proof.byte_size);
    }
    return response;
  }
  async function post(actor, assignment, bytes, mime, request = crypto.randomUUID(), omit) {
    const cookies = await actor.context.cookies(origin);
    const csrf = cookies.find(c => c.name === 'duoly-csrf')?.value;
    insist(csrf);
    const headers = { Origin: origin, 'Content-Type': mime, 'X-CSRF-Token': csrf, 'X-Assignment-Id': uuid(assignment), 'X-Idempotency-Key': uuid(request) };
    if (omit) delete headers[omit];
    return actor.context.request.post(`${origin}/api/teammate/orders/${ids[0]}/proof`, { headers, data: bytes });
  }
  async function closeServer() {
    if (!server || !server.pid) { cleanup.server_closed = true; return; }
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
      if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL');
        await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1000))]);
      }
    }
    cleanup.server_closed = server.exitCode !== null || server.signalCode !== null;
  }
  function interrupt() { interrupted = true; if (server) server.kill('SIGTERM'); }
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    const keys = cliJSON(['projects', 'api-keys', '--project-ref', REF, '--reveal', '--output', 'json']);
    key = keys.find(k => k.name === 'service_role')?.api_key;
    pub = keys.find(k => k.type === 'publishable')?.api_key;
    insist(typeof key === 'string' && typeof pub === 'string');
    phase = 'development_schema_preflight';
    const schema = sql(`select to_regclass('public.order_proof_uploads') is not null as proof_table,to_regprocedure('public.authorize_order_proof_upload(uuid,uuid)') is not null as upload_preflight,coalesce((select not public and file_size_limit=1572864 from storage.buckets where id='order-proof'),false) as private_bucket;`);
    insist(schema.length === 1 && Object.values(schema[0]).every(value => value === true));
    phase = 'fixtures';
    for (let i = 0; i < 4; i++) {
      const email = fixtureEmail(i, marker), password = crypto.randomBytes(36).toString('base64url');
      let user;
      try { user = await admin('users', 'POST', { email, password, email_confirm: true, user_metadata: { name: i < 2 ? 'Proof customer fixture' : 'Proof teammate fixture', duoly_proof_owner: marker } }); }
      catch {
        // Never retry ambiguous creation. Reconcile exact unique run marker, bounded.
        for (let attempt = 0; attempt < 3 && !user; attempt++) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          const found = discoverUsers().filter(u => u.email === email); insist(found.length <= 1);
          if (found.length) user = await ownedUser(found[0].id);
        }
        insist(user);
      }
      uuid(user.id); users.push({ id: user.id, email, password }); await ownedUser(user.id);
    }
    let setup = 'begin;';
    for (let i = 2; i < 4; i++) setup += `update public.account_roles set role='teammate' where user_id=${q(users[i].id)};insert into public.teammate_order_access(user_id,approved_games,discord_id,discord_verified_at,priority_base) values(${q(users[i].id)},array['lol'],${q((9000000000000000000n + BigInt('0x' + crypto.randomBytes(7).toString('hex'))).toString())},clock_timestamp(),0);`;
    sql(setup + orderSQL(0) + 'commit;select true as ready;');
    safe('four_confirmed_fixture_accounts_sql_roles_no_mail');
    phase = 'localhost_server';
    const port = await new Promise((resolve, reject) => { const reservation = net.createServer(); reservation.once('error', reject); reservation.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => { const p = reservation.address().port; reservation.close(() => resolve(p)); }); });
    origin = `http://127.0.0.1:${port}`;
    const env = { ...isolatedEnv(), AUTH_ENABLED: 'true', AUTH_ORIGIN: origin, SUPABASE_URL: SUPA, SUPABASE_PUBLISHABLE_KEY: pub, AUTH_COOKIE_SECRET: crypto.randomBytes(48).toString('base64url'), AUTH_ALLOW_SIGNUP: 'false', AUTH_EMAIL_ENABLED: 'false', AUTH_GOOGLE_ENABLED: 'false', AUTH_DISCORD_ENABLED: 'false', ORDER_PROOFS_ENABLED: 'true', SUPABASE_SERVICE_ROLE_KEY: key };
    server = spawn(process.execPath, [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'dev', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let spawnFailed = false; server.on('error', () => { spawnFailed = true; });
    server.stdout.on('data', () => {}); server.stderr.on('data', () => {});
    let ready = false;
    for (let i = 0; i < 200; i++) {
      insist(!interrupted && !spawnFailed && server.exitCode === null);
      try { ready = (await fetch(origin + '/api/health', { signal: AbortSignal.timeout(500) })).ok; } catch { /* bounded startup */ }
      if (ready) break; await new Promise(r => setTimeout(r, 100));
    }
    insist(ready);
    browser = await chromium.launch();
    const [customer, unrelated, teammate, replacement] = await Promise.all(users.map(actor));
    const anonymous = { context: await browser.newContext() };
    phase = 'initial_assignment';
    await teammate.page.goto(origin + '/teammate');
    await expect(teammate.page.getByRole('button', { name: 'Accept ' + refs[0], exact: true })).toBeEnabled();
    await teammate.page.getByRole('button', { name: 'Accept ' + refs[0], exact: true }).click();
    await expect(teammate.page.getByText('Assigned to you', { exact: true })).toBeVisible();
    await expect(teammate.page.getByText('No evidence uploaded.', { exact: true })).toBeVisible();
    const binding = sql(`select current_assignment_id as id from public.orders where id=${q(ids[0])} and customer_id=${q(users[0].id)} and note=${q(note)};`)[0];
    const assignment = uuid(binding.id);
    safe('real_browser_accept_and_initial_desk_read');
    // AFTER initial desk read, BEFORE the proof requests under test. No desk/order
    // refresh until this unrelated expired order has been asserted and removed.
    sql('begin;' + orderSQL(1, true) + 'commit;select true as ready;');
    function expirySnapshot() {
      const rows = sql(`select status,cancel_reason,(select count(*)::int from public.refund_credits where order_id=${q(ids[1])} and customer_id=${q(users[1].id)}) as credits from public.orders where id=${q(ids[1])} and customer_id=${q(users[1].id)} and note=${q(note)};`);
      insist(rows.length === 1); return rows[0];
    }
    const initialExpiry = expirySnapshot(); insist(initialExpiry.status === 'queued' && Number(initialExpiry.credits) === 0);
    phase = 'proof_http_browser';
    // Actual renderable source-byte fixtures, produced by browser canvas, not a
    // copied provider response or fabricated success. Retained only in memory.
    const images = [];
    for (const [i, mime] of ['image/png', 'image/jpeg', 'image/webp', 'image/png', 'image/jpeg'].entries()) {
      const data = await teammate.page.evaluate(({ i, mime }) => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const x = c.getContext('2d'); x.fillStyle = ['#123456','#654321','#218765','#aa5522','#2255aa'][i]; x.fillRect(0, 0, 160, 100); x.fillStyle = '#fff'; x.fillText('SYNTHETIC PROOF ' + (i + 1), 8, 50); return c.toDataURL(mime); }, { i, mime });
      insist(data.startsWith(`data:${mime};base64,`)); images.push({ mime, bytes: Buffer.from(data.split(',')[1], 'base64') });
    }
    const beforeRejected = objectCounts();
    for (const missing of ['X-CSRF-Token', 'Origin']) insist((await post(teammate, assignment, images[0].bytes, images[0].mime, crypto.randomUUID(), missing)).status() === 403);
    insist((await post(teammate, assignment, Buffer.from('explicit test data: not a PNG'), 'image/png')).status() === 400);
    const oversize = Buffer.alloc(MAX_BYTES + 1); images[0].bytes.copy(oversize);
    insist((await post(teammate, assignment, oversize, 'image/png')).status() === 413);
    insist(JSON.stringify(objectCounts()) === JSON.stringify(beforeRejected));
    safe('missing_csrf_origin_bad_magic_oversize_no_reservations');
    const endpoint = `/api/teammate/orders/${ids[0]}/proof`;
    let firstRequest, firstProof;
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      await teammate.page.getByLabel('Choose one evidence image', { exact: true }).setInputFiles({ name: `synthetic-${i}.${image.mime.split('/')[1]}`, mimeType: image.mime, buffer: image.bytes });
      const requestPromise = teammate.page.waitForRequest(r => r.url() === origin + endpoint && r.method() === 'POST');
      const responsePromise = teammate.page.waitForResponse(r => r.url() === origin + endpoint && r.request().method() === 'POST');
      await teammate.page.getByRole('button', { name: 'Upload selected image', exact: true }).click();
      const [request, response] = await Promise.all([requestPromise, responsePromise]); insist(response.status() === 200);
      const proof = validateProof((await response.json()).proof, ids[0], assignment);
      insist(proof.mime === image.mime && proof.byte_size === image.bytes.length);
      await expect(teammate.page.getByText(`${i + 1} / 5 images for your current assignment.`, { exact: true })).toBeVisible();
      if (i === 0) { firstRequest = request.headers()['x-idempotency-key']; uuid(firstRequest); firstProof = proof; }
    }
    safe('five_canvas_png_jpeg_webp_images_uploaded_through_ui');
    await expect(teammate.page.getByLabel('Choose one evidence image', { exact: true })).toBeDisabled();
    const beforeReplay = objectCounts(); insist(beforeReplay.proofs === 5 && beforeReplay.objects === 5);
    const replay = await post(teammate, assignment, images[0].bytes, images[0].mime, firstRequest);
    insist(replay.status() === 200 && (await replay.json()).proof.id === firstProof.id);
    insist((await post(teammate, assignment, images[1].bytes, images[1].mime, firstRequest)).status() === 409);
    insist((await post(teammate, assignment, images[0].bytes, images[0].mime)).status() === 409);
    insist(JSON.stringify(objectCounts()) === JSON.stringify(beforeReplay));
    safe('five_slot_sixth_refused_same_id_replay_no_extra_object_conflict_body');
    // Lost HTTP ACK: actually let server commit a same-ID request, discard its
    // response at the browser boundary, then explicitly retry the identical body.
    let discardedAckCommitted = false;
    await teammate.page.route('**' + endpoint, async route => {
      const response = await route.fetch();
      discardedAckCommitted = response.status() === 200 && (await response.json()).proof?.id === firstProof.id;
      await route.abort('failed');
    }, { times: 1 });
    // The real CSRF cookie is HttpOnly. Pass it from the browser context rather
    // than pretending document.cookie exposes it; never log or persist it.
    const csrf = (await teammate.context.cookies(origin)).find(c => c.name === 'duoly-csrf')?.value;
    insist(csrf);
    const lost = await teammate.page.evaluate(async ({ endpoint, assignment, request, bytes, mime, csrf }) => {
      try { await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': mime, 'X-CSRF-Token': csrf, 'X-Assignment-Id': assignment, 'X-Idempotency-Key': request }, body: Uint8Array.from(bytes) }); return false; } catch { return true; }
    }, { endpoint, assignment, request: firstRequest, bytes: [...images[0].bytes], mime: images[0].mime, csrf });
    insist(lost && discardedAckCommitted);
    const afterLost = await post(teammate, assignment, images[0].bytes, images[0].mime, firstRequest);
    insist(afterLost.status() === 200 && (await afterLost.json()).proof.id === firstProof.id);
    insist(JSON.stringify(objectCounts()) === JSON.stringify(beforeReplay));
    safe('lost_http_ack_explicit_same_request_retry_no_duplicate');
    const proofs = await list(customer, ids[0]); insist(proofs.length === 5);
    for (const proof of proofs) {
      const response = await open(customer, proof);
      insist((await response.body()).equals(images[proofs.indexOf(proof)].bytes));
      await open(teammate, proof);
      await open(anonymous, proof, 404); await open(unrelated, proof, 404);
      await open(customer, proof, 404, ids[1]);
    }
    for (const a of [anonymous, unrelated]) insist((await a.context.request.get(`${origin}/api/orders/${ids[0]}/proof`)).status() === 404);
    safe('customer_teammate_private_mime_headers_anonymous_unrelated_cross_order_404');
    for (const proof of proofs) {
      const name = proofPath(proof);
      const publicResponse = await remote(`${SUPA}/storage/v1/object/public/order-proof/${name}`);
      insist([400, 401, 403, 404].includes(publicResponse.status)); await publicResponse.arrayBuffer();
      const userResponse = await remote(`${SUPA}/storage/v1/object/authenticated/order-proof/${name}`, { headers: { apikey: pub, Authorization: `Bearer ${teammate.token}` } });
      insist([400, 401, 403, 404].includes(userResponse.status)); await userResponse.arrayBuffer();
    }
    safe('raw_storage_public_and_real_user_jwt_denied');
    await ownedUser(users[1].id);
    sql(`update public.account_roles set role='admin' where user_id=${q(users[1].id)};select role from public.account_roles where user_id=${q(users[1].id)};`);
    insist((await list(unrelated, ids[0])).length === 5);
    for (const proof of proofs) await open(unrelated, proof);
    // Browser top-level private opens (not just SDK/API responses), using actual
    // customer and freshly promoted SQL-admin sessions. Image decoding is real.
    for (const a of [customer, unrelated]) {
      const imagePage = await a.context.newPage();
      const response = await imagePage.goto(`${origin}/api/orders/${ids[0]}/proof/${firstProof.id}`);
      insist(response && response.status() === 200 && response.headers()['content-type'] === firstProof.mime && response.headers()['x-content-type-options'] === 'nosniff' && response.headers()['cache-control']?.includes('no-store'));
      await expect(imagePage.locator('img')).toHaveCount(1);
      await imagePage.locator('img').evaluate(img => img.decode());
      insist(await imagePage.locator('img').evaluate(img => img.naturalWidth > 0));
      await imagePage.close();
    }
    safe('customer_and_temporary_sql_admin_browser_private_opens');
    // No sweep-producing reads or navigation in the expiry isolation window.
    insist(JSON.stringify(expirySnapshot()) === JSON.stringify(initialExpiry));
    safe('proof_requests_leave_unrelated_expired_status_and_refund_credits_unchanged');
    assertOwnedOrders();
    sql(`begin;delete from public.refund_credits where order_id=${q(ids[1])} and customer_id=${q(users[1].id)};delete from public.orders where id=${q(ids[1])} and customer_id=${q(users[1].id)} and note=${q(note)};commit;select count(*)::int as count from public.orders where id=${q(ids[1])};`).forEach(row => insist(Number(row.count) === 0));
    safe('expired_fixture_removed_before_intentional_reroll_accept_sweeps');
    phase = 'reroll';
    await customer.page.goto(`${origin}/queue/${ids[0]}`);
    await expect(customer.page.getByRole('button', { name: 'Switch teammate', exact: true })).toBeEnabled();
    await customer.page.getByRole('button', { name: 'Switch teammate', exact: true }).click();
    await expect(customer.page.getByText('Queued', { exact: true })).toBeVisible();
    await replacement.page.goto(origin + '/teammate');
    await replacement.page.getByRole('button', { name: 'Accept ' + refs[0], exact: true }).click();
    await expect(replacement.page.getByText('Assigned to you', { exact: true })).toBeVisible();
    await expect(replacement.page.getByText('No evidence uploaded.', { exact: true })).toBeVisible();
    insist((await list(replacement, ids[0])).length === 0);
    insist((await teammate.context.request.get(`${origin}/api/orders/${ids[0]}/proof`)).status() === 404);
    for (const proof of proofs) { await open(teammate, proof, 404); await open(replacement, proof, 404); await open(customer, proof); await open(unrelated, proof); }
    safe('reroll_former_404_replacement_no_old_proof_customer_admin_retain');
    phase = 'mobile';
    for (const [a, route] of [[customer, `/queue/${ids[0]}`], [replacement, '/teammate']]) {
      await a.page.setViewportSize({ width: 390, height: 844 }); await a.page.goto(origin + route);
      await expect(a.page.locator('astro-island[ssr]')).toHaveCount(0);
      await expect(a.page.getByRole('region', { name: 'Private evidence', exact: true })).toBeVisible();
      await a.page.locator('img').evaluateAll(async imgs => { for (const img of imgs) { img.loading = 'eager'; try { await img.decode(); } catch {} } });
      insist(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      insist(await a.page.locator('img').evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0 && !img.hidden)));
    }
    insist(pageErrors === 0); safe('authenticated_mobile_no_overflow_broken_hidden_images_or_pageerrors');
    completed = true;
  } catch { /* SDK/CLI/Playwright errors may contain credentials or private data. */ }
  finally {
    phase = completed ? 'cleanup' : phase;
    try { if (browser) await browser.close(); cleanup.browser_closed = true; } catch {}
    try { await closeServer(); } catch {}
    // Discover ambiguous late-created users too; never delete by guessed email.
    try {
      insist(cleanup.browser_closed && cleanup.server_closed);
      if (key) {
        const discovered = discoverUsers();
        for (const u of discovered) {
          await ownedUser(u.id);
          if (!users.some(v => v.id === u.id)) users.push({ id: u.id, email: u.email });
        }
        if (users.length) {
          for (const u of users) await ownedUser(u.id);
          assertOwnedOrders();
          const bindings = ownedProofs();
          for (const binding of bindings) {
            proofPath(binding);
            // Pending/abandoned reservations may never have acquired bytes.
            if (!(await storage(binding))) await storage(binding, 'DELETE');
            insist(await storage(binding));
          }
          // Verify provider absence AND scoped storage catalog count before deleting
          // SQL bindings. Do not orphan provider bytes by deleting metadata first.
          insist(objectCounts().objects === 0); cleanup.storage_absent = true;
          sql(`begin;
            do $$ begin if exists(select 1 from public.orders where id in (${idsSQL()}) and (customer_id not in (${usersSQL()}) or note<>${q(note)})) then raise exception 'Ownership refused'; end if; end $$;
            delete from public.order_proof_uploads where order_id in (select id from public.orders where id in (${idsSQL()}) and customer_id in (${usersSQL()}) and note=${q(note)});
            update public.orders set status='queued',current_assignment_id=null,assigned_teammate_id=null,accepted_at=null,completed_at=null,cancelled_at=null,cancel_reason=null where id in (${idsSQL()}) and customer_id in (${usersSQL()}) and note=${q(note)};
            delete from public.refund_credits where order_id in (${idsSQL()}) and customer_id in (${usersSQL()});
            delete from public.order_assignments where order_id in (${idsSQL()});
            delete from public.orders where id in (${idsSQL()}) and customer_id in (${usersSQL()}) and note=${q(note)};
            delete from public.teammate_order_access where user_id in (${usersSQL()});
            delete from public.account_roles where user_id in (${usersSQL()});
            commit;select true as cleaned;`);
          const counts = sql(`select (select count(*)::int from public.order_proof_uploads where order_id in (${idsSQL()})) as proofs,(select count(*)::int from public.orders where id in (${idsSQL()})) as orders,(select count(*)::int from public.order_assignments where order_id in (${idsSQL()})) as assignments,(select count(*)::int from public.refund_credits where customer_id in (${usersSQL()})) as credits,(select count(*)::int from public.teammate_order_access where user_id in (${usersSQL()})) as access,(select count(*)::int from public.account_roles where user_id in (${usersSQL()})) as roles;`);
          insist(counts.length === 1 && Object.values(counts[0]).every(v => Number(v) === 0)); cleanup.rows_absent = true;
          for (const u of users) { await ownedUser(u.id); await admin('users/' + u.id, 'DELETE'); }
          const remaining = sql(`select (select count(*)::int from auth.users where id in (${usersSQL()}) or raw_user_meta_data->>'duoly_proof_owner'=${q(marker)}) as users,(select count(*)::int from public.profiles where id in (${usersSQL()})) as profiles;`);
          insist(remaining.length === 1 && Object.values(remaining[0]).every(v => Number(v) === 0)); cleanup.users_absent = true;
        } else { cleanup.storage_absent = true; cleanup.rows_absent = true; cleanup.users_absent = true; }
      }
    } catch { /* Fail closed, preserve records if ownership/storage cannot be proved. */ }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    key = undefined; pub = undefined;
  }
  const ok = completed && Object.values(cleanup).every(Boolean) && !interrupted;
  console.log(JSON.stringify({ ok, phase, checks, check_count: checks.length, synthetic_development_orders: true, real_payments: false, runtime_pageerrors: pageErrors, cleanup }));
  if (!ok) process.exitCode = 1;
}
module.exports = { parseArgs, proofPath, isolatedEnv, absentStorage, fixtureEmail, assertFixtureUser, validateProof };
if (require.main === module) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch { console.error(JSON.stringify({ ok: false, error: 'GUARD_REFUSED' })); process.exitCode = 1; }
  if (options) run(options).catch(() => { console.error(JSON.stringify({ ok: false, error: 'PREFLIGHT_REFUSED' })); process.exitCode = 1; });
}
