import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

function redactText(value: unknown) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]');
}

export function initializeMonitoring() {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  const appVariant = String(Constants.expoConfig?.extra?.appVariant ?? 'development');

  Sentry.init({
    dsn,
    enabled: Boolean(dsn) && !__DEV__,
    environment: appVariant,
    sendDefaultPii: false,
    attachStacktrace: true,
    enableAutoSessionTracking: true,
    tracesSampleRate: appVariant === 'production' ? 0.1 : 0.25,
    beforeSend(event) {
      if (event.user) {
        event.user.email = undefined;
        event.user.ip_address = undefined;
        event.user.username = undefined;
      }
      if (event.request) {
        event.request.cookies = undefined;
        event.request.headers = undefined;
        event.request.data = undefined;
      }
      if (event.message) event.message = String(redactText(event.message));
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') return null;
      if (breadcrumb.message) breadcrumb.message = String(redactText(breadcrumb.message));
      // Console arguments can contain nested Supabase responses. Keep the
      // scrubbed message, not the raw argument object.
      if (breadcrumb.category === 'console') breadcrumb.data = undefined;
      return breadcrumb;
    },
  });

  if (!__DEV__) {
    // Device logs can contain card/user identifiers and are not a production
    // observability channel. Explicit reportError calls and uncaught errors are
    // still captured by Sentry with the scrubbers above.
    console.log = () => undefined;
    console.info = () => undefined;
    console.debug = () => undefined;
    console.warn = () => undefined;
    console.error = () => undefined;
  }
}

export function setMonitoringUser(userId: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) scope.setContext('cramit', context);
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

export { Sentry };
