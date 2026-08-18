export const getSentryRelease = (env?: Record<string, string>): string => {
  if (typeof process !== "undefined" && process.env && process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  if (env && env.VITE_VERCEL_GIT_COMMIT_SHA) {
    return env.VITE_VERCEL_GIT_COMMIT_SHA;
  }
  return "development";
};

export const initSentrySafely = async (dsn?: string, sampleRateStr?: string) => {
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      release: getSentryRelease(import.meta.env),
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: parseFloat(sampleRateStr || "1.0"),
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch {
    console.warn("@sentry/react not available, skipping Sentry init");
  }
};
