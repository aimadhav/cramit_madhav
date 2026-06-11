# Auth & Tokens: The "Cramit" Security Blueprint

This document explains exactly how authentication works in this project. Use this to prepare for technical interviews.

---

## 1. The Strategy: "Hybrid Persistence"
In React Native, we have two main ways to save data:
1.  **AsyncStorage**: Fast, but not encrypted. Good for user preferences (Theme, Name).
2.  **SecureStore**: Slower, but **encrypted**. Essential for secrets (Tokens).

**Our implementation uses both.** We store the User Profile in AsyncStorage so the UI loads instantly, but we keep the Access Tokens in SecureStore to prevent hackers from stealing them.

---

## 2. The Token "Twin" System
We receive two tokens from Supabase:

### A. Access Token (`sessionToken`)
*   **Role**: The "VIP Pass."
*   **Life Span**: Usually 1 hour.
*   **Usage**: Sent in the header of every API request to Supabase.

### B. Refresh Token
*   **Role**: The "Voucher."
*   **Life Span**: Much longer (weeks/months).
*   **Usage**: Used only when the Access Token expires. The app sends this "Voucher" to Supabase to get a fresh Access Token without making the user type their password again.

---

## 3. The Auth Flow (Step-by-Step)

### Step 1: Identification (`login.tsx`)
The user submits their credentials. We call `supabase.auth.signInWithPassword`. 
*   *Interview Tip*: Mention that we also support **OAuth** (Google Login) via `WebBrowser.openAuthSessionAsync`.

### Step 2: The Handover (`user-store.ts` -> `setSession`)
Once Supabase says "OK," we take that data and:
1.  Update the **Zustand State** (so the app knows we are logged in).
2.  Save the `access_token` and `refresh_token` to `SecureStore`.
3.  Save the `AppUser` object to `AsyncStorage`.

### Step 3: The "Bouncer" (`_layout.tsx`)
The app uses a "Root Guard" and an **Auth Listener**:
1.  **Navigation Guard**: We check the `sessionToken` to redirect users between `/login` and the main app.
2.  **Supabase Listener**: We use `supabase.auth.onAuthStateChange` to automatically handle token refreshes and session revocations in the background.

---

## 4. The "Offline Mode" Hack
To let users study without an account, we created `OFFLINE_MODE_TOKEN`.
*   When a user clicks "Continue Offline," we set the `sessionToken` to a hardcoded string: `'offline-mode-token'`.
*   The **Bouncer** sees a token exists and lets the user in.
*   **Safety Check**: Our `SyncService` is programmed to look for this specific string. If it sees the offline token, it **stops** the sync to prevent errors with Supabase.

---

## 5. Potential Interview Questions

**Q: Why don't you just store the token in AsyncStorage?**
*   **A**: AsyncStorage is just a plain text file on the device. On a rooted or jailbroken phone, other apps could potentially read that file. SecureStore uses hardware-level encryption (iOS Keychain / Android Keystore), making it the industry standard for tokens.

**Q: How do you handle a user closing the app and reopening it?**
*   **A**: We use `checkAuthStatus` during the "Hydration" phase. In `_layout.tsx`, before showing the UI, we read from SecureStore. If a token is found, we re-populate the Zustand store so the user stays logged in seamlessly.

**Q: What is the most robust part of your auth system?**
*   **A**: The **Auth Listener** in `_layout.tsx`. By subscribing to `onAuthStateChange`, the app becomes "self-healing." If a token is refreshed in the background, the Zustand store is updated instantly. If the session is revoked (like a remote logout), the app detects it and kicks the user to the login screen immediately without them having to click anything.
