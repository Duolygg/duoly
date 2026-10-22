import type { EmailContent } from '../model.ts';

/**
 * Supabase Auth emails. Supabase sends these itself through the configured Resend SMTP,
 * filling the Go-template placeholders. The rendered HTML is written to supabase/templates.
 *
 * Variables: https://supabase.com/docs/guides/auth/auth-email-templates#terminology
 * Expiry copy matches supabase/config.toml otp_expiry = 3600 (1 hour).
 */

export function confirmSignup(): EmailContent {
  return {
    subject: 'Confirm your email for Duoly',
    preheader: 'One tap and your account is ready. The link expires in 1 hour.',
    eyebrow: 'One quick step',
    title: 'Confirm your email,',
    titleAccent: 'then duo up.',
    hero: 'brand',
    blocks: [
      {
        type: 'paragraph',
        text: 'Tap the button to confirm {{ .Email }} and finish setting up your Duoly account. The link works once and expires in 1 hour.',
      },
      {
        type: 'button',
        label: 'Confirm my email',
        url: '{{ .ConfirmationURL }}',
      },
      { type: 'linkFallback', url: '{{ .ConfirmationURL }}' },
      {
        type: 'note',
        tone: 'info',
        title: 'Didn’t sign up?',
        text: 'You can safely ignore this email. Nothing happens unless someone uses the link.',
      },
    ],
    reason:
      'You’re getting this because someone signed up for Duoly with this address.',
  };
}

export function resetPassword(): EmailContent {
  return {
    subject: 'Reset your Duoly password',
    preheader: 'Choose a new password. The link expires in 1 hour.',
    eyebrow: 'Password reset',
    title: 'Forgot your password?',
    titleAccent: 'Happens to the best.',
    hero: 'mascots',
    blocks: [
      {
        type: 'paragraph',
        text: 'Someone asked to reset the password for {{ .Email }}. Tap the button to choose a new one. The link works once and expires in 1 hour.',
      },
      {
        type: 'button',
        label: 'Choose a new password',
        url: '{{ .ConfirmationURL }}',
      },
      { type: 'linkFallback', url: '{{ .ConfirmationURL }}' },
      {
        type: 'note',
        tone: 'warn',
        title: 'Didn’t ask for this?',
        text: 'Ignore this email and your password stays the same. Duoly will never ask for your password in chat or on Discord.',
      },
    ],
    reason:
      'You’re getting this because a password reset was requested for your Duoly account.',
  };
}

export function changeEmail(): EmailContent {
  return {
    subject: 'Confirm your new email address',
    preheader: 'Confirm the switch to {{ .NewEmail }}.',
    eyebrow: 'Email change',
    title: 'New email,',
    titleAccent: 'same duo.',
    hero: 'mascots',
    blocks: [
      {
        type: 'paragraph',
        text: 'Confirm that you want to move your Duoly sign-in from {{ .Email }} to {{ .NewEmail }}.',
      },
      {
        type: 'paragraph',
        text: 'For your security, both addresses get a link and the change goes through once both are confirmed.',
      },
      {
        type: 'button',
        label: 'Confirm email change',
        url: '{{ .ConfirmationURL }}',
      },
      { type: 'linkFallback', url: '{{ .ConfirmationURL }}' },
      {
        type: 'note',
        tone: 'warn',
        title: 'Wasn’t you?',
        text: 'Don’t click anything. Change your password and contact support so we can secure your account.',
      },
    ],
    reason:
      'You’re getting this because an email change was requested for your Duoly account.',
  };
}

export function reauthentication(): EmailContent {
  return {
    subject: 'Your Duoly security code',
    preheader: 'Use this code to confirm it’s you. It expires in 1 hour.',
    eyebrow: 'Security check',
    title: 'Confirm it’s you.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Enter this code on Duoly to finish the change you started.',
      },
      {
        type: 'code',
        code: '{{ .Token }}',
        caption:
          'Expires in 1 hour. Duoly support will never ask you for this code.',
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Didn’t request a code?',
        text: 'Someone may know your password. Change it now and contact support.',
      },
    ],
    reason:
      'You’re getting this because a security check was requested for your Duoly account.',
  };
}

export function passwordChanged(): EmailContent {
  return {
    subject: 'Your Duoly password was changed',
    preheader: 'If this was you, there’s nothing else to do.',
    eyebrow: 'Security notice',
    title: 'Your password',
    titleAccent: 'was changed.',
    blocks: [
      {
        type: 'paragraph',
        text: 'The password for {{ .Email }} was just changed. If this was you, there’s nothing else to do.',
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Wasn’t you?',
        text: 'Reset your password right away and contact support so we can lock your account down.',
      },
      { type: 'button', label: 'Reset password', url: '{{ .SiteURL }}/login' },
    ],
    reason: 'You’re getting this security notice for your Duoly account.',
  };
}

export function emailChanged(): EmailContent {
  return {
    subject: 'Your Duoly sign-in email was changed',
    preheader: 'Your account now signs in with {{ .Email }}.',
    eyebrow: 'Security notice',
    title: 'Your sign-in email',
    titleAccent: 'was changed.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Your Duoly account now signs in with {{ .Email }} in place of {{ .OldEmail }}.',
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Wasn’t you?',
        text: 'Contact support right away. Include the old address so we can find and secure your account.',
      },
      {
        type: 'button',
        label: 'Contact support',
        url: '{{ .SiteURL }}/contact',
      },
    ],
    reason: 'You’re getting this security notice for your Duoly account.',
  };
}
