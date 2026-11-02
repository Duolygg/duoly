import { z } from 'zod';

export const GAME_IDS = [
  'lol',
  'val',
  'cs2',
  'fn',
  'cod',
  'apex',
  'r6',
  'mr',
  'ow',
  'rl',
  'tft',
  'fc',
  'arc',
  'mc',
  'pu',
  'social',
] as const;
const GameIdSchema = z.enum(GAME_IDS);

export const QueueSettingsResponseSchema = z
  .object({
    allowed_games: z.array(GameIdSchema).max(GAME_IDS.length),
    enabled_games: z.array(GameIdSchema).max(GAME_IDS.length),
    gg_access: z.boolean(),
    voice_opt_in: z.boolean(),
    // Added by 20261102140000 (the comp games); optional so code can deploy before the migration.
    approved_games: z.array(GameIdSchema).max(GAME_IDS.length).optional(),
  })
  .strict();

export const QueueSettingsCommandSchema = z
  .object({
    csrf: z.string().min(1).max(128),
    enabledGames: z.array(GameIdSchema).max(GAME_IDS.length),
    voiceOptIn: z.boolean(),
  })
  .strict();
