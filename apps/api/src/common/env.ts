/** Fail fast on a bad configuration instead of failing on the first request. */
// Validates configuration once at startup
export function checkEnv() {
  // Collects every problem so all are shown together
  const problems: string[] = [];
  // Database connection string is mandatory
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  // JWT signing secret
  const secret = process.env.JWT_SECRET ?? '';
  const prod = process.env.NODE_ENV === 'production';
  if (!secret) problems.push('JWT_SECRET is not set');
  // Weak secrets are refused in production
  else if (prod && secret.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production');
  // Fixed OTP / no OTP would be a security hole in production
  if (prod && ['dev', 'off'].includes(process.env.OTP_MODE ?? 'dev')) problems.push('OTP_MODE must not be dev or off in production (connect an SMS provider and use OTP_MODE=prod)');
  // Print all problems and exit with an error code
  if (problems.length) {
    console.error('\nConfiguration problems:\n - ' + problems.join('\n - ') + '\n\nCopy .env.example to .env and fill it in.\n');
    process.exit(1);
  }
}
