# GitHub Android beta release

This branch intentionally builds a separate Android application:

- Display name: `Cramit Beta`
- Package: `com.cramit.app.beta`
- Deep-link scheme: `cramit-beta`
- EAS profile: `preview`

The production application identity remains unchanged on `mobile-hardening`.

## One-time dashboard setup

1. In Supabase Auth URL Configuration, allow these exact redirect URLs:
   - `cramit-beta://auth/callback`
   - `cramit-beta://auth/reset-password`
2. Deploy the pending Supabase migration and account-deletion function:
   - `npx supabase login`
   - `npx supabase link --project-ref khaufzqlziexfoispitm`
   - `npx supabase db push`
   - `npx supabase functions deploy delete-account --project-ref khaufzqlziexfoispitm`
3. Add `SENTRY_AUTH_TOKEN` to the EAS `preview` environment as a secret. The
   public DSN and project values are already configured in EAS.
4. Enable GitHub Pages for the repository's `/docs` folder so the privacy,
   support and deletion pages resolve at the URLs configured by the app.

## Verify and build

```bash
npm ci
npm run ts:check
npm test
npm run lint
npx expo-doctor
npx eas-cli@latest build --profile preview --platform android
```

Install the resulting APK on a clean Android device and verify email sign-up,
Google sign-in, onboarding, a complete review session, offline restart, sync,
password recovery, settings links, and account deletion before attaching the
APK to a GitHub prerelease.
