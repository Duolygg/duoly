import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20261024130000_order_completion.sql',
  'utf8',
);

describe('completion migration guardrails (static; real SQL suites are separate)', () => {
  it('keeps immutable audit tables private with explicit RLS and no raw grants', () => {
    for (const table of [
      'teammate_earning_entries',
      'order_completion_proofs',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public,anon,authenticated,service_role`,
      );
    }
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete|all)\b/i);
    expect(sql).toContain(
      'before update or delete on public.teammate_earning_entries',
    );
    expect(sql).toContain(
      'before update or delete on public.order_completion_proofs',
    );
    expect(sql).toContain(
      'references public.order_proof_uploads(id) on delete restrict',
    );
  });

  it('exposes only authenticated completion and self-derived paginated earnings', () => {
    expect(sql).toContain(
      'public.complete_order(p_order_id uuid,p_assignment_id uuid,p_proof_ids uuid[],p_request_id uuid)',
    );
    expect(sql).toContain(
      'public.teammate_earnings(p_limit integer default 20,p_offset integer default 0)',
    );
    expect(sql.match(/grant execute on function/g)).toHaveLength(2);
    expect(sql).not.toMatch(/to (anon|service_role);/);
    expect(sql).toContain(
      "return public.order_error(401,'Authentication required.')",
    );
    expect(sql).toContain(
      "language plpgsql security definer set search_path = ''",
    );
    expect(sql).toContain('where e.teammate_id=v_actor');
  });

  it('consumes settled capture and booked integer cents, retaining exact retry results', () => {
    expect(sql).toContain("pay.state <> 'captured' or pay.settle <> 'none'");
    expect(sql).toContain('e.request_id=p_request_id and e.proof_ids=v_proofs');
    expect(sql).toContain('if found then return v_result; end if;');
    expect(sql).toContain('unique (teammate_id,request_id)');
    expect(sql).toContain(
      'held_usd_cents = (payout_usd_cents * deposit_percent + 50) / 100',
    );
    expect(sql).toContain('held_usd_cents + net_usd_cents = payout_usd_cents');
    expect(sql).toContain('prior_completed_count >= 1000');
    expect(sql).not.toMatch(
      /update public\.(order_payments|checkout_intents)|stripe\./i,
    );
  });

  it('ends the assignment and changes only historical-final chat membership', () => {
    expect(sql).toContain("set ended_at=v_now,end_reason='completed'");
    expect(sql).toContain("set status='completed',completed_at=v_now");
    expect(sql).toContain(
      "a.end_reason='completed' and a.ended_at is not null",
    );
    expect(sql).not.toMatch(/public\.order_chat_(append|invalidate)\(/);
    expect(sql).not.toMatch(
      /create (?:or replace )?function public\.(accept_order|reroll_order|order_post_refund|send_order_chat_message)\(/,
    );
    expect(sql).not.toMatch(
      /insert into public\.(refund_credits|stripe_events)/,
    );
  });
});
