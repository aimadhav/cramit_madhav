# Production Readiness Checklist & Post-Audit Actions

This document outlines the final steps required to move from the current state to a production-ready MVP.

## 1. App Configuration (app.json)
- [ ] **Android Package Name**: Change `"package": "com.new2.expoapp"` to a unique brand ID (e.g., `"com.cramit.app"`). **This is permanent once published.**
- [ ] **Versioning**: Set `"version": "1.0.0"` and `"android.versionCode": 1`. Increment `versionCode` for every Store upload.
- [ ] **App Name**: Confirm `"name": "cramit"` is your desired display name.
- [ ] **Assets**: Replace default Expo icons/splash screens with production-ready assets in the `assets` folder.

## 2. Supabase & Security (CRITICAL)
- [ ] **Enable RLS**: Go to Supabase Dashboard -> Authentication -> Policies. Enable RLS for `decks`, `flashcards`, and `user_flashcard_statuses`.
    - **Decks Policy**: `SELECT` where `is_public = true OR auth.uid()::text = user_id`.
    - **Flashcards Policy**: `SELECT` where deck is public or owned by user.
- [ ] **URL Configuration**:
    - Remove `exp://` development redirect links.
    - Add your production scheme (e.g., `myapp://auth/callback`) and your web domain to the Redirect Allow List.
- [ ] **OAuth Fingerprints**: Generate SHA-1 fingerprint via `eas credentials` and add it to Google Cloud Console to enable Google Login in the standalone APK/AAB.

## 3. Data & Content
- [ ] **Verify Image Fix**: Ensure images load correctly. (Note: You may need to clear local app data once to force a re-sync with the new field mappings).
- [ ] **Quick Prep Tab**: Decide whether to implement the `MOCK_CURRICULUM` features or hide the tab for the MVP launch.

## 4. Deployment Process (EAS)
- [ ] **Install EAS CLI**: `npm install -g eas-cli`
- [ ] **Build AAB**: Run `eas build --platform android --profile production`.
- [ ] **Keystore**: Let Expo generate and manage your production keystore. **Do not lose access to your Expo account.**

## 5. Google Play Console
- [ ] **Developer Account**: Pay the one-time $25 fee.
- [ ] **Privacy Policy**: Host a privacy policy URL (required for apps with authentication).
- [ ] **Closed Testing**: Prepare for the 14-day mandatory test with 20 testers (for new accounts).
- [ ] **Data Safety**: Disclose collection of Email, Name, and Encrypted transit (Supabase).

---
*Note: Code-level audit findings (Image bugs, N+1 queries, Transactions, and Token logging) have already been patched as of June 2026.*
