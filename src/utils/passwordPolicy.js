// Password rules used everywhere a password is set (reset, change, new users).
// Mirror these in Supabase → Authentication → Providers → Email → Password requirements.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: p => p.length >= 10 },
  { id: 'upper', label: 'An uppercase letter', test: p => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: p => /[a-z]/.test(p) },
  { id: 'number', label: 'A number', test: p => /\d/.test(p) },
  { id: 'symbol', label: 'A symbol (e.g. ! @ # $ %)', test: p => /[^A-Za-z0-9]/.test(p) },
];

export const passwordIssues = (p = '') => PASSWORD_RULES.filter(r => !r.test(p));
export const isStrongPassword = p => passwordIssues(p).length === 0;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
export const isEmail = e => EMAIL_RE.test(String(e || '').trim());

/** Friendly text for Supabase Auth errors. */
export function authErrorMessage(error) {
  const code = error?.code || '';
  const msg = (error?.message || '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'Incorrect email or password.';
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit') || error?.status === 429)
    return 'Too many requests. Please wait a few minutes and try again.';
  if (code === 'same_password' || msg.includes('should be different')) return 'Your new password must be different from your current password.';
  if (code === 'weak_password' || msg.includes('weak')) return 'That password is too weak. Please choose a stronger one.';
  if (code === 'otp_expired' || msg.includes('expired')) return 'This link has expired. Please request a new one.';
  if (msg.includes('email not confirmed')) return 'Please confirm your email address before signing in.';
  return error?.message || 'Something went wrong. Please try again.';
}
