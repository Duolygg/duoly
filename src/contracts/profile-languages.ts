/*
 * GENERATED FILE. Do not edit by hand: run `pnpm build:game-picks`.
 *
 * The spoken languages picker. `id` is the English name already stored in profiles.languages and
 * listed in PROFILE_LANGUAGES, so this file adds display detail only and changes nothing on the
 * wire. `endonym` is the language's own name for itself, shown as secondary text when it differs.
 * `code` is ISO 639-1, shown as a small badge; a language is never drawn as a country flag,
 * because English, German, French, Portuguese, Arabic and Chinese all cross borders.
 *
 * `suggested` is the editorial order of the short Suggested group (an audience hypothesis, not
 * measured demand). It never preselects anything and never implies a main language.
 */
export type ProfileLanguage = {
  id: string;
  endonym: string;
  code: string;
  suggested: number;
};
/** Suggested order first; the picker sorts the full list by name itself. */
export const PROFILE_LANGUAGE_DETAIL: ProfileLanguage[] = [
  { id: 'English', endonym: 'English', code: 'EN', suggested: 1 },
  { id: 'German', endonym: 'Deutsch', code: 'DE', suggested: 2 },
  { id: 'French', endonym: 'français', code: 'FR', suggested: 3 },
  { id: 'Dutch', endonym: 'Nederlands', code: 'NL', suggested: 4 },
  { id: 'Polish', endonym: 'polski', code: 'PL', suggested: 5 },
  { id: 'Spanish', endonym: 'español', code: 'ES', suggested: 6 },
  { id: 'Italian', endonym: 'italiano', code: 'IT', suggested: 7 },
  { id: 'Swedish', endonym: 'svenska', code: 'SV', suggested: 8 },
  { id: 'Danish', endonym: 'dansk', code: 'DA', suggested: 9 },
  { id: 'Norwegian', endonym: 'norsk', code: 'NO', suggested: 10 },
  { id: 'Finnish', endonym: 'suomi', code: 'FI', suggested: 11 },
  { id: 'Portuguese', endonym: 'português', code: 'PT', suggested: 12 },
  { id: 'Turkish', endonym: 'Türkçe', code: 'TR', suggested: 13 },
  { id: 'Romanian', endonym: 'română', code: 'RO', suggested: 14 },
  { id: 'Czech', endonym: 'čeština', code: 'CS', suggested: 15 },
  { id: 'Ukrainian', endonym: 'українська', code: 'UK', suggested: 16 },
  { id: 'Russian', endonym: 'русский', code: 'RU', suggested: 17 },
  { id: 'Hungarian', endonym: 'magyar', code: 'HU', suggested: 18 },
  { id: 'Greek', endonym: 'Ελληνικά', code: 'EL', suggested: 19 },
  { id: 'Bulgarian', endonym: 'български', code: 'BG', suggested: 20 },
  { id: 'Slovak', endonym: 'slovenčina', code: 'SK', suggested: 21 },
  { id: 'Serbian', endonym: 'српски', code: 'SR', suggested: 22 },
  { id: 'Croatian', endonym: 'hrvatski', code: 'HR', suggested: 23 },
  { id: 'Lithuanian', endonym: 'lietuvių', code: 'LT', suggested: 24 },
  { id: 'Latvian', endonym: 'latviešu', code: 'LV', suggested: 25 },
  { id: 'Estonian', endonym: 'eesti', code: 'ET', suggested: 26 },
  { id: 'Slovenian', endonym: 'slovenščina', code: 'SL', suggested: 27 },
  { id: 'Bosnian', endonym: 'bosanski', code: 'BS', suggested: 28 },
  { id: 'Albanian', endonym: 'shqip', code: 'SQ', suggested: 29 },
  { id: 'Macedonian', endonym: 'македонски', code: 'MK', suggested: 30 },
  { id: 'Catalan', endonym: 'català', code: 'CA', suggested: 31 },
  { id: 'Icelandic', endonym: 'íslenska', code: 'IS', suggested: 32 },
  { id: 'Arabic', endonym: 'العربية', code: 'AR', suggested: 33 },
  { id: 'Chinese', endonym: '中文', code: 'ZH', suggested: 34 },
  { id: 'Japanese', endonym: '日本語', code: 'JA', suggested: 35 },
  { id: 'Korean', endonym: '한국어', code: 'KO', suggested: 36 },
];
/**
 * How many of them lead the picker as "Suggested". Six, because the group is a shortcut past
 * the A to Z list and not a second list: ten of them filled a phone sheet on their own and left
 * "All languages" under the fold, where nothing said the list went on.
 */
export const LANGUAGES_SUGGESTED = 6;
