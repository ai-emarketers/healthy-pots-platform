/** Fail fast on a bad configuration instead of failing on the first request. */
export function checkEnv() {
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  const secret = process.env.JWT_SECRET ?? '';
  const prod = process.env.NODE_ENV === 'production';
  if (!secret) problems.push('JWT_SECRET is not set');
  else if (prod && secret.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production');
  if (prod && ['dev', 'off'].includes(process.env.OTP_MODE ?? 'dev')) problems.push('OTP_MODE must not be dev or off in production (connect an SMS provider and use OTP_MODE=prod)');
  if (problems.length) {
    console.error('\nConfiguration problems:\n - ' + problems.join('\n - ') + '\n\nCopy .env.example to .env and fill it in.\n');
    process.exit(1);
  }
}
