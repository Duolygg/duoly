import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20261024110000_order_chat.sql';
const migration = () =>
  existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('order chat database boundary (static, not provider execution)', () => {
  it('keeps all persistence private with RLS and explicit application-role revokes', () => {
    const sql = migration();
    for (const table of [
      'rooms',
      'messages',
      'attempts',
      'rate_accounts',
      'typing',
      'flags',
    ]) {
      expect(sql).toContain(`create table public.order_chat_${table}`);
      expect(sql).toContain(
        `alter table public.order_chat_${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.order_chat_${table} from public, anon, authenticated, service_role`,
      );
    }
    expect(sql).not.toMatch(
      /grant\s+(select|insert|all).*on\s+(table\s+)?public\.order_chat_/i,
    );
  });
  it('exposes only the agreed snake_case RPCs and fresh authorization', () => {
    const sql = migration();
    for (const name of [
      'get_order_chat',
      'send_order_chat_message',
      'set_order_chat_typing',
      'list_order_chat_flags',
      'resolve_order_chat_flag',
    ]) {
      expect(sql).toContain(`create function public.${name}(`);
      expect(sql).toMatch(
        new RegExp(
          `grant execute on function public\\.${name}\\([^;]*to authenticated;`,
        ),
      );
    }
    expect(sql).toContain('create function public.order_chat_viewer(');
    expect(sql).toContain('a.end_reason is null');
    expect(sql).toContain('not x.suspended');
    expect(sql).toContain("r.role = 'admin'");
    expect(sql).toContain(
      "'writable',coalesce(v_viewer <> 'admin' and v.status = 'in_progress' and v.current_assignment_id = v_assignment,false)",
    );
    expect(sql).not.toContain("extension = 'broadcast' and private");
    const get =
      sql.split('create function public.get_order_chat(')[1]?.split('$$;')[0] ??
      '';
    expect(get).toContain(
      'from public.account_roles as r where r.user_id = auth.uid() for share',
    );
    expect(get).toContain(
      'from public.teammate_order_access as x where x.user_id = auth.uid() for share',
    );
    expect(get.indexOf('from public.account_roles')).toBeLessThan(
      get.indexOf('from public.orders'),
    );
    expect(sql).toContain('WITHHOLD application until explicitly');
    expect(sql).not.toMatch(/order_sweep\(|order_expire_locked\(/);
  });

  it('makes retries durable independently of message retention and serializes account rate checks', () => {
    const sql = migration();
    const send =
      sql
        .split('create function public.send_order_chat_message(')[1]
        ?.split('$$;')[0] ?? '';
    expect(send).toContain('for update');
    expect(send.indexOf('public.order_chat_rate_accounts')).toBeLessThan(
      send.indexOf('select o.* into v from public.orders'),
    );
    expect(send).toContain("interval '1 minute'");
    expect(send).toContain('>= 20');
    expect(send).toContain('v_prior.body_digest <> v_digest');
    expect(send).toContain('return v_prior.result');
    expect(send).toContain(
      "return public.order_error(400,'Unsupported control characters.');",
    );
    expect(send).toContain('update public.order_chat_typing set expires_at =');
    expect(send).not.toContain('delete from public.order_chat_typing');
    expect(sql).toContain(String.raw`\FEFF`);
    expect(send).toContain('public.order_chat_block_rule(v_body)');
    expect(send).toContain('insert into public.order_chat_flags');
    expect(sql).toContain('offset 200');
    expect(sql).not.toMatch(/delete from public\.order_chat_attempts/i);
    expect(sql).toContain("interval '4 seconds'");
    expect(sql).toContain("interval '2 seconds'");
  });

  it('uses PostgreSQL word boundaries, exact note, and no raw Broadcast payloads', () => {
    const sql = migration();
    expect(sql).toContain(
      String.raw`\m(pass(word|wort)?|login details|account details)`,
    );
    expect(sql).not.toContain(String.raw`\b`);
    expect(sql).toContain(
      'Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.',
    );
    expect(sql).toContain(
      "realtime.send('{\"changed\":true}'::jsonb, 'chat_changed', 'order-chat:'",
    );
    expect(sql).toContain('as restrictive for select');
    expect(sql).toContain('as restrictive for insert');
    expect(sql).toContain('realtime.topic()');
    expect(sql).toContain("extension = 'broadcast'");
    expect(sql).toContain(
      'create function public.order_chat_can_receive_topic(p_topic text)',
    );
  });

  it('provides idempotent system hooks, unique warnings, and an owned rollback behavioral suite', () => {
    const sql = migration();
    expect(sql).toContain('create trigger orders_chat_transition');
    expect(sql).toContain('accepted_emitted');
    expect(sql).toContain('completed_emitted');
    expect(sql).toContain("f.status = 'warned'");
    expect(sql).toContain('if v_flag.status = p_status then');
    const suitePath = 'supabase/tests/order_chat.sql';
    const suite = existsSync(suitePath) ? readFileSync(suitePath, 'utf8') : '';
    expect(suite).toContain('Fixture collision');
    expect(suite).toContain('set local role authenticated');
    expect(suite).toContain('set local role anon');
    expect(suite).toMatch(/rollback;\s*$/);
    expect(suite).toContain('Blocked text reached recipient');
    expect(suite).toContain('Retry consumed another rate slot');
    expect(suite).toContain('Former teammate read archive');
    expect(suite).toContain('Duplicate warning counted');
    expect(suite).toContain('500 Unicode code points');
  });
});
