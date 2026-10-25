const config = window.__POSTHOG_CONFIG__;

function requirePostHogConfig(name) {
  if (config?.isDevelopment) {
    throw new Error(`${name} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${name} is configured`);
  }
}

if (!config?.projectToken) {
  requirePostHogConfig('POSTHOG_PROJECT_TOKEN');
} else if (!config?.host) {
  requirePostHogConfig('POSTHOG_HOST');
} else {
  !function (t, e) { let o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { const o = e.split('.'); if (o.length === 2) { t = t[o[0]]; e = o[1]; } t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; } p = t.createElement('script'); p.type = 'text/javascript'; p.crossOrigin = 'anonymous'; p.async = !0; p.src = s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js'; r = t.getElementsByTagName('script')[0]; r.parentNode.insertBefore(p, r); const u = a !== undefined ? e[a] = [] : e; a = a || 'posthog'; u.people = u.people || []; Object.defineProperty(u, 'toString', { configurable: !0, enumerable: !0, writable: !0, value: function (t) { let e = a; if (a !== 'posthog') e += '.' + a; if (!t) e += ' (stub)'; return e; } }); Object.defineProperty(u.people, 'toString', { configurable: !0, enumerable: !0, writable: !0, value: function () { return u.toString(1) + '.people'; } }); o = 'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetGroupPropertiesForFlags resetPersonPropertiesForFlags alias reset get_distinct_id getGroups get_session_id get_session_replay_url captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(' '); for (n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]); }, e.__SV = 1); }(document, window.posthog || []);

  window.posthog.init(config.projectToken, {
    api_host: config.host,
    defaults: '2026-05-30',
    logs: {
      serviceName: 'typezone-web',
      environment: config.isDevelopment ? 'development' : 'production',
    },
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  });
}
