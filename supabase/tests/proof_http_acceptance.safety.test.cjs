'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const RUNNER = path.join(__dirname, 'proof_http_acceptance.cjs');
const REF = 'omnejesspybaxuacjlah';
test('import is inert and exports offline guards', () => {
  const savedFetch = global.fetch;
  global.fetch = () => {
    throw new Error('IMPORT_NETWORK_FORBIDDEN');
  };
  try {
    const runner = require(RUNNER);
    assert.equal(typeof runner.parseArgs, 'function');
    assert.equal(typeof runner.proofPath, 'function');
  } finally {
    global.fetch = savedFetch;
  }
});
test('requires exact project, fixture consent and explicit absolute target', () => {
  const { parseArgs } = require(RUNNER);
  const good = [
    '--project-ref',
    REF,
    '--allow-development-fixtures',
    '--root',
    '/target/proof',
  ];
  assert.deepEqual(parseArgs(good), { projectRef: REF, root: '/target/proof' });
  for (const args of [
    [],
    good.slice(0, 2),
    good.filter((x) => x !== '--allow-development-fixtures'),
    good.map((x) => (x === REF ? 'production' : x)),
    good.map((x) => (x === '/target/proof' ? '../proof' : x)),
    [...good, '--unknown'],
    [...good, '--root', '/other'],
    good.map((x) => (x === '/target/proof' ? '/target/../proof' : x)),
  ]) {
    assert.throws(() => parseArgs(args));
  }
});
test('rejects unsafe object bindings without normalizing malformed tokens', () => {
  const { proofPath } = require(RUNNER);
  const id = 'aabbccdd-1234-4234-8234-123456789abc';
  const b = { order_id: id, assignment_id: id, id };
  assert.equal(proofPath(b), [id, id, id].join('/'));
  for (const value of [
    '../x',
    id + '/x',
    ' ' + id,
    id.replaceAll('-', ''),
    '%2e%2e',
    id.toUpperCase(),
    '00000000-0000-0000-0000-000000000000',
  ]) {
    for (const key of Object.keys(b))
      assert.throws(() => proofPath({ ...b, [key]: value }));
  }
});
test('invalid invocation refuses before dependencies, CLI, server or network', () => {
  const result = spawnSync(process.execPath, [RUNNER], {
    encoding: 'utf8',
    env: {},
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    error: 'GUARD_REFUSED',
  });
});
test('minimal child env cannot inherit credentials, Node injections or auth bypasses', () => {
  const { isolatedEnv } = require(RUNNER);
  assert.deepEqual(
    isolatedEnv({
      PATH: '/node24/bin',
      HOME: '/fixture-home',
      TMPDIR: '/fixture-scratch',
      LANG: 'C',
      SUPABASE_SERVICE_ROLE_KEY: 'never-forward',
      SUPABASE_ACCESS_TOKEN: 'never-forward',
      AUTH_ENABLED: 'false',
      NODE_OPTIONS: '--require unsafe.cjs',
      NODE_PATH: '/unsafe',
      VITE_SECRET: 'never-forward',
      DEBUG: '*',
    }),
    {
      PATH: '/node24/bin',
      HOME: '/fixture-home',
      TMPDIR: '/fixture-scratch',
      LANG: 'C',
    },
  );
});
test('provider absence requires 404 or exact documented structured not-found', () => {
  const { absentStorage } = require(RUNNER);
  assert.equal(absentStorage(404), true);
  assert.equal(
    absentStorage(400, { statusCode: '404', error: 'not_found' }),
    true,
  );
  for (const [status, body] of [
    [403],
    [500],
    [400],
    [400, { statusCode: 404, error: 'not_found' }],
    [400, { statusCode: '404', error: 'permission_denied' }],
    [400, { error: 'not_found' }],
  ]) {
    assert.equal(absentStorage(status, body), false);
  }
});
test('fixture emails are uniquely run-owned invalid-domain addresses', () => {
  const { fixtureEmail } = require(RUNNER);
  const marker = 'aabbccdd-1234-4234-8234-123456789abc';
  assert.equal(
    new Set([0, 1, 2, 3].map((i) => fixtureEmail(i, marker))).size,
    4,
  );
  assert.equal(
    fixtureEmail(0, marker),
    `duoly-proof-0-${marker}@example.invalid`,
  );
  for (const index of [-1, 4, 0.5, '0'])
    assert.throws(() => fixtureEmail(index, marker));
  assert.throws(() => fixtureEmail(0, "x' OR true"));
});
test('strict implemented DTO rejects locators and mismatched bindings', () => {
  const { validateProof } = require(RUNNER);
  const order = 'aabbccdd-1234-4234-8234-123456789abc';
  const other = 'aabbccdd-1234-4234-8234-123456789abd';
  const proof = {
    id: order,
    order_id: order,
    assignment_id: order,
    mime: 'image/png',
    byte_size: 100,
    created_at: '2026-10-22T12:00:00Z',
  };
  assert.equal(validateProof(proof, order, order), proof);
  for (const bad of [
    { ...proof, storage_key: 'private/path' },
    { ...proof, mime: 'image/svg+xml' },
    { ...proof, byte_size: 1572865 },
    { ...proof, byte_size: 0 },
    { ...proof, created_at: 'invalid' },
  ]) {
    assert.throws(() => validateProof(bad, order, order));
  }
  assert.throws(() => validateProof(proof, other));
  assert.throws(() => validateProof(proof, order, other));
});
test('user deletion ownership needs exact ID, marker and fixture email', () => {
  const { assertFixtureUser } = require(RUNNER);
  const id = 'aabbccdd-1234-4234-8234-123456789abc';
  const marker = 'aabbccdd-1234-4234-8234-123456789abd';
  const user = {
    id,
    email: `duoly-proof-0-${marker}@example.invalid`,
    user_metadata: { duoly_proof_owner: marker },
  };
  assert.equal(assertFixtureUser(user, id, marker), user);
  for (const bad of [
    { ...user, id: marker },
    { ...user, email: 'real-owner@gmail.com' },
    { ...user, user_metadata: {} },
    { ...user, user_metadata: { duoly_proof_owner: id } },
  ]) {
    assert.throws(() => assertFixtureUser(bad, id, marker));
  }
});
