# How to Test Authentication in Cramit

Testing Auth is split into two parts: **Logic Testing** (what the code does) and **Manual Testing** (what the human does).

## 1. Logic Testing (Automated with Vitest)
We use Unit Tests to verify our `AuthService` and `UserStore` logic.

### Testing "Wrong Password" Scenario
In `services/auth-service.test.ts`, we simulate a failure from Supabase:

```typescript
it('should throw an error if Supabase returns an error', async () => {
  const mockError = { message: 'Invalid login credentials' };
  
  // We MOCK Supabase to pretend it returned an error
  (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
    data: { user: null, session: null },
    error: mockError,
  });

  // We check that our service throws the error correctly
  await expect(AuthService.signIn('test@example.com', 'wrongpass'))
    .rejects.toThrow('Invalid login credentials');
});
```

### Testing "Empty Fields" Scenario
This is handled in the UI layer (`login.tsx`). Even without a running UI test, we can verify the logic:
1. The code checks `if (!email.trim() || !password.trim())`.
2. If true, it calls `Alert.alert('Validation Error', ...)`.

---

## 2. Manual Testing (The "Human" Check)
Some things are better tested by hand on a real device or simulator.

### How to test Error Popups:
1. Open the app.
2. Go to the Login screen.
3. Type a random email like `fake@email.com`.
4. Type a random password.
5. Tap **Login**.
6. **Expectation:** A popup (Alert) should appear saying "Login Failed: Invalid login credentials".

### How to test Token Security:
1. Log in.
2. Force-close the app (swipe it away).
3. Open the app again.
4. **Expectation:** You should be automatically logged in (Dashboard shows up) because the token was saved in `SecureStore`.

---

## 3. What can't be tested through code?
1. **FaceID / TouchID**: Automated tests cannot "look" at your face to verify biometrics.
2. **Real Google Login**: We cannot automate clicking the Google "Sign In" button and entering a real 2FA code.
3. **Network Failure**: While we can "mock" a network error, testing how the real antenna reacts to a "tunnel" or "dead zone" requires a physical phone.

---

## 4. Why did we refactor to AuthService?
By moving logic to `AuthService`, we can test the **Login Logic** without needing to render the **Login Screen**. This makes our tests:
*   **Faster**: Unit tests take milliseconds.
*   **Reliable**: They don't fail just because a button moved 5 pixels.
*   **Clearer**: We test one thing at a time (The logic, then the UI).
