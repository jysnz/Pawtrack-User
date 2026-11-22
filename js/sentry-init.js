/**
 * Starts Sentry for the guardian app and the admin console (loaded after js/vendor/sentry.browser.*.min.js and
 * js/sentry-config.js). Anything that throws in a visitor's browser (uncaught errors, unhandled promise rejections,
 * and errors the app reports itself) is sent to Sentry, where an alert rule emails the team.
 *
 * Exposes window.pawSentry:
 *   report(error, context)   send a handled error (use it in catch blocks that would otherwise swallow a failure)
 *   setUser(id)              tag events with the signed-in account id (an id only, never an email or a name)
 * Everything is a safe no-op when Sentry is off, blocked by an ad blocker, or the DSN is not set.
 */
(function () {
  var cfg = window.PAWTRACK_SENTRY || {};
  var S = window.Sentry;
  var noop = function () {};
  var api = { enabled: false, report: noop, setUser: noop };
  window.pawSentry = api;

  if (!S || !cfg.dsn) return;

  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.slice(-6) === '.local';
  if (isLocal && !cfg.sendInDev) return;

  var isAdmin = /\/admin(\/|$)/.test(location.pathname);
  var environment = cfg.environment || (isLocal ? 'development' : (/\.vercel\.app$/.test(host) && /-git-|-[a-z0-9]{9}-/.test(host) ? 'preview' : 'production'));

  // Failures that are noise, not bugs: browser quirks, extensions, flaky networks, third-party scripts
  var IGNORE_ERRORS = [
    /ResizeObserver loop/i,
    /Non-Error promise rejection captured/i,
    /^Script error\.?$/,
    /Failed to fetch|NetworkError|Load failed|network request failed|The network connection was lost/i,
    /AbortError|The user aborted a request|The operation was aborted/i,
    /NotAllowedError|Permission denied|User denied/i,
    /ChunkLoadError|Loading CSS chunk/i,
    /chrome-extension:|moz-extension:|safari-extension:/i
  ];
  var DENY_URLS = [
    /extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari(-web)?-extension:\/\//i,
    /challenges\.cloudflare\.com/i, /maps\.googleapis\.com/i, /gstatic\.com/i
  ];

  try {
    S.init({
      dsn: cfg.dsn,
      environment: environment,
      release: cfg.release || undefined,
      sampleRate: typeof cfg.sampleRate === 'number' ? cfg.sampleRate : 1,
      ignoreErrors: IGNORE_ERRORS,
      denyUrls: DENY_URLS,
      maxBreadcrumbs: 30,
      sendDefaultPii: false,
      initialScope: { tags: { app: isAdmin ? 'admin-console' : 'guardian-app' } },
      // Never ship anything a person typed or a secret: strip query strings and form values from what we send
      beforeSend: function (event) {
        try {
          if (event.request && event.request.url) event.request.url = event.request.url.split('?')[0];
          if (event.request) { delete event.request.cookies; delete event.request.query_string; }
        } catch (e) {}
        return event;
      },
      beforeBreadcrumb: function (crumb) {
        // Typed text can be personal: keep clicks and navigation, drop the content of input events
        if (crumb && crumb.category === 'ui.input') return null;
        return crumb;
      }
    });
  } catch (e) {
    return; // monitoring must never break the app
  }

  api.enabled = true;
  // The same failure repeating (a poll that keeps failing, a loop) is reported once a minute, so one outage
  // cannot flood the inbox or use up the Sentry quota
  var recent = {};
  api.report = function (error, context) {
    try {
      var key = String(error && error.message ? error.message : error).slice(0, 200);
      var now = Date.now();
      if (recent[key] && now - recent[key] < 60000) return;
      recent[key] = now;
      S.withScope(function (scope) {
        if (context) {
          if (context.tags) Object.keys(context.tags).forEach(function (k) { scope.setTag(k, String(context.tags[k])); });
          if (context.extra) scope.setContext('details', context.extra);
          if (context.level) scope.setLevel(context.level);
        }
        S.captureException(error instanceof Error ? error : new Error(String(error && error.message ? error.message : error)));
      });
    } catch (e) {}
  };
  api.setUser = function (id) {
    try { S.setUser(id ? { id: String(id) } : null); } catch (e) {}
  };
})();
