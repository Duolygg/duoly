/**
 * Tiny escaping HTML builder for email markup.
 *
 * Interpolated values are escaped unless they are already SafeHtml. Email HTML needs exact
 * control over tables, attributes and Outlook conditional comments, so templates use this
 * instead of a browser rendering framework.
 */
export class SafeHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
}

type Interpolation =
  SafeHtml | string | number | false | null | undefined | Interpolation[];

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(
    /[&<>"']/g,
    (character) => ESCAPES[character] ?? character,
  );
}

function serialize(value: Interpolation): string {
  if (value === false || value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(String(value));
}

export function markup(
  strings: TemplateStringsArray,
  ...values: Interpolation[]
): SafeHtml {
  let out = '';
  strings.forEach((chunk, index) => {
    out += chunk;
    if (index < values.length) out += serialize(values[index]);
  });
  return new SafeHtml(out);
}

/** Trusted, author-controlled markup only. Never pass user or provider data. */
export function raw(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

/** Only http(s), mailto and Supabase Go-template placeholders are allowed as link targets. */
export function safeUrl(url: string): string {
  const trimmed = url.trim();
  // Supabase Auth Go-template placeholders, optionally followed by a fixed path.
  if (/^\{\{ \.[A-Za-z]+ \}\}(\/[A-Za-z0-9/_\-.#?=]*)?$/.test(trimmed))
    return trimmed;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  throw new Error(`Refusing unsafe email link: ${trimmed.slice(0, 40)}`);
}
