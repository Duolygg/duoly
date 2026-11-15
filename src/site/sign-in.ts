// There is no sign-in page: signing in always happens in the popup. Server redirects send
// people to the homepage with ?signin=1 (plus an error or notice), which opens it there.
export const SIGN_IN = '/?signin=1';

export type SignInError =
  'callback' | 'provider' | 'credentials' | 'eligibility' | 'suspended';
export type SignInNotice = 'registered' | 'confirmation';

export function signInPath(
  extra: { error?: SignInError; notice?: SignInNotice } = {},
): string {
  if (extra.error) return `${SIGN_IN}&error=${extra.error}`;
  if (extra.notice) return `${SIGN_IN}&notice=${extra.notice}`;
  return SIGN_IN;
}

const ERRORS: Record<SignInError, string> = {
  callback: 'Sign-in could not be completed. Please start again.',
  provider: 'That sign-in provider is temporarily unavailable.',
  credentials:
    'That email and password don’t match. Try again or reset your password.',
  eligibility: 'This environment is restricted to its approved test account.',
  suspended:
    'Your account is suspended, so you can’t sign in right now. Contact us at hello@duoly.gg.',
};
const NOTICES: Record<SignInNotice, string> = {
  registered: 'This email already has an account. Log in instead.',
  confirmation: 'Check your inbox and confirm your email, then log in.',
};

/** The line the popup shows for ?error= / ?notice= (unknown values show nothing). */
export function signInMessage(params: URLSearchParams): {
  error?: string;
  notice?: string;
} {
  const error = params.get('error') ?? '';
  if (Object.hasOwn(ERRORS, error))
    return { error: ERRORS[error as SignInError] };
  const notice = params.get('notice') ?? '';
  if (Object.hasOwn(NOTICES, notice))
    return { notice: NOTICES[notice as SignInNotice] };
  return {};
}
