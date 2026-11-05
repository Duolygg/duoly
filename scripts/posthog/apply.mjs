#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { buildPlan } from './plan.mjs';
import {
  ApiClient,
  HOST,
  PROJECT,
  ROOT,
  readKey,
  upsert,
  matches,
  contains,
} from './lib.mjs';

const flags = new Set(process.argv.slice(2));
if (
  [...flags].some(
    (f) => !['--apply', '--dry-run', '--verify-queries'].includes(f),
  ) ||
  (flags.has('--apply') && flags.has('--dry-run'))
)
  throw new Error(
    'Usage: node scripts/posthog/apply.mjs [--dry-run | --apply] [--verify-queries]',
  );
const apply = flags.has('--apply');
const plan = buildPlan();
const api = new ApiClient({ key: readKey(), apply });
const report = {
  project: PROJECT,
  mode: apply ? 'apply' : 'dry-run',
  settings: [],
  preserved: {},
  objects: [],
  deferredProperties: [],
  limitations: [],
  queryChecks: [],
};
const object = (type, row) => {
  const slug = {
    dashboards: 'dashboard',
    insights: 'insights',
    cohorts: 'cohorts',
    actions: 'data-management/actions',
    surveys: 'surveys',
    alerts: 'insights/alerts',
    event_definitions: 'data-management/events',
    property_definitions: 'data-management/properties',
  }[type];
  report.objects.push({
    type,
    name: row.name,
    id: row.id,
    url: `${HOST}/project/${PROJECT}/${slug}/${type === 'insights' ? row.short_id : row.id}`,
  });
};
const projectPath = `/api/projects/${PROJECT}/`;
const project = await api.request(projectPath);
for (const [key, after] of Object.entries(plan.settings))
  if (!contains(project[key], after))
    report.settings.push({ key, before: project[key], after });
const preserveKeys = Object.keys(project).filter(
  (k) =>
    /^(session_recording|session_replay|capture_console_log|capture_performance|recording_domains)/.test(
      k,
    ) || ['anonymize_ips', 'cookieless_server_hash_mode'].includes(k),
);
if (apply && report.settings.length)
  await api.request(projectPath, { method: 'PATCH', body: plan.settings });
const projectAfter = await api.request(projectPath);
if (apply && !matches(projectAfter, plan.settings))
  throw new Error('Settings read-back mismatch');
for (const key of preserveKeys)
  if (!contains(projectAfter[key], project[key]))
    throw new Error(`Protected setting changed: ${key}`);
report.preserved = {
  anonymize_ips: projectAfter.anonymize_ips,
  cookieless_server_hash_mode: projectAfter.cookieless_server_hash_mode,
  recordingSettingsUnchanged: true,
};

const heatmapPath = `${ROOT}heatmap_capture/settings/`;
const heatmapBefore = await api.request(heatmapPath);
if (!matches(heatmapBefore, plan.heatmapSettings)) {
  report.settings.push({
    key: 'heatmap_capture',
    before: heatmapBefore,
    after: plan.heatmapSettings,
  });
  if (apply)
    await api.request(heatmapPath, {
      method: 'PATCH',
      body: plan.heatmapSettings,
    });
}
const heatmapAfter = await api.request(heatmapPath);
if (apply && !matches(heatmapAfter, plan.heatmapSettings))
  throw new Error('Heatmap settings read-back mismatch');
report.heatmapSettings = heatmapAfter;
// Read every pagination page before deciding whether to create anything.
const resources = {};
for (const type of [
  'event_definitions',
  'property_definitions',
  'actions',
  'cohorts',
  'dashboards',
  'insights',
  'surveys',
  'alerts',
])
  resources[type] = await api.list(
    type,
    type === 'insights' ? 'include_dashboards=true' : '',
  );
for (const payload of plan.events)
  object(
    'event_definitions',
    await upsert(
      api,
      'event_definitions',
      resources.event_definitions,
      payload,
      { canonical: true },
    ),
  );
for (const { events: _events, ...payload } of plan.properties) {
  void _events;
  if (!resources.property_definitions.some((p) => p.name === payload.name)) {
    report.deferredProperties.push(payload.name);
    continue; // API has no property-definition POST. Do not inject synthetic events.
  }
  object(
    'property_definitions',
    await upsert(
      api,
      'property_definitions',
      resources.property_definitions,
      payload,
      { canonical: true },
    ),
  );
}
const personProperties = await api.list('property_definitions', 'type=person');
for (const [name, description] of [
  ['$internal_or_test_user', 'Internal or test account: exclude true.'],
  ['role', 'Authenticated browser role: customer or teammate.'],
]) {
  if (!personProperties.some((p) => p.name === name)) {
    report.deferredProperties.push(`person:${name}`);
    continue;
  }
  object(
    'property_definitions',
    await upsert(
      api,
      'property_definitions',
      personProperties,
      {
        name,
        description: `[duoly] ${description}`,
        tags: ['duoly', 'identity'],
        verified: true,
      },
      { canonical: true },
    ),
  );
}
for (const type of ['actions', 'cohorts'])
  for (const payload of plan[type])
    object(type, await upsert(api, type, resources[type], payload));
const boards = new Map();
for (const { number, ...payload } of plan.dashboards) {
  const row = await upsert(api, 'dashboards', resources.dashboards, {
    ...payload,
    tags: ['duoly'],
    pinned: false,
  });
  boards.set(number, row.id);
  object('dashboards', row);
}
const insights = new Map();
for (const { key, board, events: _events, ...payload } of plan.insights) {
  void _events;
  const row = await upsert(api, 'insights', resources.insights, {
    ...payload,
    dashboards: [boards.get(board)],
    tags: ['duoly'],
  });
  insights.set(key, row);
  object('insights', row);
  if (apply && flags.has('--verify-queries')) {
    try {
      let result = await api.request(`${ROOT}query/`, {
        method: 'POST',
        body: { query: payload.query, async: false },
      });
      if (result.query_status?.error) throw new Error('Query execution error');
      if (result.query_status?.complete === false) {
        const id = result.query_status.id;
        for (
          let attempt = 0;
          attempt < 60 && result.query_status?.complete === false;
          attempt++
        ) {
          await api.sleep(1000);
          result = await api.request(`${ROOT}query/${id}/`);
        }
        if (
          result.query_status?.complete === false ||
          result.query_status?.error
        )
          throw new Error('Query unfinished or failed');
      }
      report.queryChecks.push({ key, status: 'passed' });
    } catch (error) {
      report.queryChecks.push({
        key,
        status: 'failed',
        reason: error.message,
        ...(error.validation ? { validation: error.validation } : {}),
      });
    }
  }
}
for (const payload of plan.surveys)
  object('surveys', await upsert(api, 'surveys', resources.surveys, payload));
const existingOtherAlerts = resources.alerts.filter(
  (a) => !plan.alerts.some((p) => p.name === a.name),
);
if (existingOtherAlerts.length + plan.alerts.length > 5)
  throw new Error(
    'Refusing to exceed the free 5-alert cap or delete owner alerts',
  );
// Notification recipients use the authenticated owner account; do not persist identity.
const owner = await api.request('/api/users/@me/');
if (!owner.id || !owner.email)
  throw new Error('Cannot resolve alert recipient');
for (const { insightKey, ...payload } of plan.alerts) {
  const complete = {
    ...payload,
    insight: insights.get(insightKey).id,
    subscribed_users: [owner.id],
  };
  // The alerts API represents email subscriptions by user ID, not literal email.
  try {
    object('alerts', await upsert(api, 'alerts', resources.alerts, complete));
  } catch (error) {
    if (![402, 403, 404].includes(error.status)) throw error;
    report.limitations.push(
      `Alerts unavailable: HTTP ${error.status}; no upgrade attempted.`,
    );
    break;
  }
}
if (apply) {
  for (const [number, id] of boards) {
    const board = await api.request(`${ROOT}dashboards/${id}/`);
    const expected = plan.insights
      .filter((i) => i.board === number)
      .map((i) => insights.get(i.key).id);
    const attached =
      board.tiles?.filter((t) => t.insight).map((t) => t.insight.id) || [];
    if (
      !expected.every((id) => attached.includes(id)) ||
      new Set(attached).size !== attached.length
    )
      throw new Error(`Dashboard ${id} missing or duplicate insight tiles`);
  }
}
report.limitations.push(
  'Property definitions cannot be created by REST (no POST); missing properties are described in plan.mjs and will be updated after real ingestion. No synthetic data captured.',
  'Both Web Analytics conversionGoal overviews are saved as native insights on Acquisition. The standalone Web Analytics UI goal selector is per-view; choose user_signed_up/order_funded there manually if needed, no global goal-list REST endpoint exists.',
  'Heatmap URL allowlist configured through heatmap_capture/settings for /, /games/* and /pro (3-entry free cap). API reports enforcement_enabled=false; saved allowlist is verified but server enforcement rollout cannot be enabled here. No session recording settings changed.',
  'Surveys remain drafts: site config has disable_surveys:true. Survey A cannot express same-session NOT order_funded in SurveyConditionsSchema. Both single question, 100 lifetime responses each, 7-day wait; free allowance 1500 responses/month org-wide.',
  'Replay Vision monitor and Discord destinations deliberately not created; owner decides later.',
  'No real scheduler heartbeat exists: outbox source counts are an activity proxy. Six idle hours can alert even when drain is healthy.',
  'Alert thresholds: checkout_failed >5/hour (absolute spike proxy, no baseline yet); order_expired >3/day; zero outbox 6h; zero pageviews 24h; zero funding 3d. Hourly, no AI investigations.',
  'Personless business facts count in totals but cannot support reliable identity funnels, retention, repeat customers or PRO state. No historical subscription baseline; no exact per-order pass metric or refund deltas.',
);
report.counts = api.counts;
const path = new globalThis.URL(
  apply ? './last-apply.json' : './last-dry-run.json',
  import.meta.url,
);
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
globalThis.console.log(
  JSON.stringify(
    {
      mode: report.mode,
      counts: report.counts,
      settings: report.settings,
      dashboards: report.objects.filter((o) => o.type === 'dashboards'),
      deferredProperties: report.deferredProperties,
      queryFailures: report.queryChecks.filter((q) => q.status !== 'passed'),
    },
    null,
    2,
  ),
);
if (report.queryChecks.some((q) => q.status !== 'passed')) process.exitCode = 1;
