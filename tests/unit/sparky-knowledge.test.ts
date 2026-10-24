import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE,
  knowledgeFor,
  knowledgeMatch,
} from '../../src/server/support/knowledge';
import {
  buildGroundingContext,
  preparedReply,
  type SupportPerson,
} from '../../src/server/support/sparky';

const guest: SupportPerson = { role: 'guest', name: 'Guest' };
const teammate = (over: Partial<NonNullable<SupportPerson['teammate']>> = {}) =>
  ({
    role: 'teammate',
    userId: '00000000-0000-4000-8000-000000000001',
    name: 'Tia',
    teammate: {
      assignment: null,
      completedOrders: 3,
      recordedEarningsUsdCents: 1200,
      approvedGames: ['valorant'],
      discordConnected: true,
      suspended: false,
      ...over,
    },
  }) as SupportPerson;

describe('Sparky knowledge from the original assistant', () => {
  it('keeps teammate-only topics away from guests and customers', () => {
    const ids = (role: SupportPerson['role']) =>
      knowledgeFor(role).map((entry) => entry.id);
    for (const id of ['priority', 'trust', 'pay', 'handover', 'proof'])
      expect(ids('guest')).not.toContain(id);
    expect(ids('customer')).not.toContain('priority');
    expect(ids('teammate')).toContain('priority');
  });

  it('never states priority numbers', () => {
    const priority = KNOWLEDGE.find((entry) => entry.id === 'priority')!;
    expect(priority.text).not.toMatch(/\d/);
    expect(priority.text).toMatch(/internal/);
  });

  it('follows the owner copy rules and drops retired claims', () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.text, entry.id).not.toMatch(/[\u2013\u2014&]/);
      expect(entry.text, entry.id).not.toMatch(
        /wallet (credit|balance)|cashback/i,
      );
    }
  });

  it('routes the original intents in the no-AI fallback', () => {
    expect(knowledgeMatch('teammate', 'how do handover links work')?.id).toBe(
      'handover',
    );
    expect(knowledgeMatch('teammate', 'What are the rules?')?.id).toBe('rules');
    expect(knowledgeMatch('customer', 'can I leave a review')?.id).toBe('rate');
    expect(knowledgeMatch('guest', 'what is my priority')).toBeNull();
    expect(
      preparedReply(teammate(), 'what about the golden rules').text,
    ).toMatch(/online means ready/);
  });

  it('explains going online from the teammate’s own state', () => {
    expect(
      preparedReply(teammate({ suspended: true }), 'Why can’t I go online?')
        .text,
    ).toMatch(/suspended/);
    expect(
      preparedReply(
        teammate({ discordConnected: false }),
        'Why can’t I go online?',
      ).text,
    ).toMatch(/Connect your Discord/);
    expect(
      preparedReply(teammate({ approvedGames: [] }), 'Why can’t I go online?')
        .text,
    ).toMatch(/approved for any game/);
    expect(preparedReply(teammate(), 'Why can’t I go online?').text).toMatch(
      /Online switch/,
    );
  });

  it('puts only the asker’s knowledge into the AI context and no stale claims', () => {
    const forGuest = buildGroundingContext(guest);
    expect(forGuest).toContain('DUOLY KNOWLEDGE');
    expect(forGuest).not.toContain('The exact numbers are internal');
    const forTeammate = buildGroundingContext(teammate());
    expect(forTeammate).toContain('The exact numbers are internal');
    expect(forTeammate).not.toMatch(/presence.{0,40}coming later/i);
    expect(forTeammate).not.toMatch(/star reviews.{0,60}coming later/i);
  });
});
