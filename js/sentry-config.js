/**
 * PawTrack error monitoring (Sentry) settings.
 *
 * The DSN is a public value (it only lets the app SEND errors, never read them), so it is safe in the browser.
 * Paste yours from Sentry: Project Settings -> Client Keys (DSN). While `dsn` is empty, monitoring stays off and
 * the app runs exactly as before.
 *
 *   dsn          Sentry project DSN, e.g. 'https://abc123@o123456.ingest.sentry.io/456789'
 *   environment  'production' | 'staging' | ... (auto-detected from the hostname when left empty)
 *   release      Version label shown in Sentry (Vercel's commit SHA is a good value); optional
 *   sampleRate   0..1, share of errors sent. Keep 1 until traffic is high, then lower it to protect your quota.
 *   sendInDev    true to also report errors raised on localhost
 */
window.PAWTRACK_SENTRY = {
  dsn: '',
  environment: '',
  release: '',
  sampleRate: 1,
  sendInDev: false
};
