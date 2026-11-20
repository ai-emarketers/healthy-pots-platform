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
  // Exception: OTP_MODE=dev (fixed code) is allowed in production only when ALLOW_FIXED_OTP=true is set on purpose (demo/testing)
  const otpMode = process.env.OTP_MODE ?? 'dev';
  const fixedOtpAllowed = otpMode === 'dev' && process.env.ALLOW_FIXED_OTP === 'true';
  if (prod && fixedOtpAllowed) console.warn('[security] ALLOW_FIXED_OTP=true: anyone can log in as any customer with the fixed OTP. Demo/testing only.');
  if (prod && ['dev', 'off'].includes(otpMode) && !fixedOtpAllowed) problems.push('OTP_MODE must not be dev or off in production (connect an SMS provider and use OTP_MODE=prod, or set ALLOW_FIXED_OTP=true for demo use)');
  // Production OTP needs Twilio credentials
  if (prod && process.env.OTP_MODE === 'prod' && !(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID))) problems.push('OTP_MODE=prod needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID)');
  // Print all problems and exit with an error code
  if (problems.length) {
    console.error('\nConfiguration problems:\n - ' + problems.join('\n - ') + '\n\nCopy .env.example to .env and fill it in.\n');
    process.exit(1);
  }
}
