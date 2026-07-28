# Firebase Configuration Guide: Fix `auth/operation-not-allowed`

## Problem Summary

Users attempting to sign up or log in with email/password encounter:
```
errorFirebase: Error (auth/operation-not-allowed)
```

This error occurs because the **Email/Password authentication provider is disabled** in your Firebase Console.

---

## Solution: Enable Email/Password Provider

### Step 1: Open Firebase Console
1. Navigate to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Select your project from the list
3. Click **Authentication** in the left sidebar

### Step 2: Access Sign-In Methods
1. Click the **"Sign-in method"** tab (first tab after "Users")
2. You should see a list of providers under "Native providers"

### Step 3: Enable Email/Password
1. Find **"Email/Password"** in the list
2. Check its current status:
   - ✓ **If it says "Enabled"** → Skip to Step 4 (already done!)
   - ✗ **If it's grayed out or disabled** → Click on it
3. A drawer will open on the right side
4. **Toggle the "Enable" switch** to the ON position
5. Ensure the **"Email/Password"** checkbox is checked
6. Click **"Save"** at the bottom

### Step 4: Verify the Change
1. Wait 1-2 minutes for Firebase to propagate the change
2. Hard refresh your application (Cmd+Shift+R or Ctrl+Shift+R)
3. Try signing up/in with email and password again

---

## Configuration Checklist

- [ ] Email/Password provider is **ENABLED** in Firebase Console
- [ ] Firebase Realtime Database read/write rules are configured
- [ ] OAuth redirect URIs include your domain:
  - Development: `localhost:3000` (or your dev port)
  - Production: `your-domain.com`
- [ ] Email verification is optional but recommended
- [ ] Password reset flow is enabled (default)

---

## Additional Configuration (Recommended)

### Enable Email Enumeration Protection
This prevents attackers from determining if an email is registered:

1. Go to **Authentication** > **Sign-in method**
2. Click on **"Email/Password"**
3. Check **"Enable email enumeration protection"**
4. Click **"Save"**

### Add Custom Error Messages (Optional)
For a better user experience, customize error messages in Firebase Console:

1. Go to **Authentication** > **Settings** (gear icon)
2. Click **"User actions"** tab
3. Configure custom email templates for verification and password reset

---

## How to Handle Auth Errors in Your App

### The Auth Flow in `auth.ts`

The application now includes a production-ready authentication layer that:

1. **Validates input** before sending to Firebase
2. **Catches Firebase errors** and extracts error codes
3. **Converts error codes to user-friendly messages**
4. **Never exposes raw Firebase errors** to the user

#### Example Error Handling

```typescript
import { signInWithEmail } from './lib/auth';

const result = await signInWithEmail(email, password);

if (!result.success) {
  // User-friendly message (safe for display)
  displayError(result.errorMessage);
  
  // Error code for logging/debugging
  console.error('[v0] Auth failed:', result.errorCode);
}
```

### Common Error Codes and Meanings

| Error Code | User Message | What to Do |
|---|---|---|
| `auth/operation-not-allowed` | "Email login is currently disabled by the administrator." | Enable Email/Password in Firebase Console |
| `auth/user-not-found` | "No account found. Please sign up first." | Show sign-up form |
| `auth/wrong-password` | "Incorrect email or password." | Retry or reset password |
| `auth/email-already-in-use` | "Email already registered. Please sign in instead." | Show sign-in form |
| `auth/weak-password` | "Password must be at least 6 characters." | Update UI with password requirements |
| `auth/too-many-requests` | "Too many failed attempts. Please try again later." | Rate limit - show cooldown timer |

---

## Troubleshooting

### Issue: Still Getting `auth/operation-not-allowed` After Enabling?

**Solution:**
1. Clear your browser cache (DevTools > Application > Clear site data)
2. Wait 2-3 minutes for Firebase to fully propagate
3. Try signing in from an incognito/private window
4. Verify you're in the correct Firebase project

### Issue: Getting `auth/account-exists-with-different-credential`?

**Meaning:** User signed up with Google but is trying to log in with email (or vice versa)

**Solution (for users):**
- Sign in using the same method they used to create the account (Google or Email)

**Solution (for developers):**
- Implement account linking in your app to allow users to connect multiple auth methods
- See Firebase docs on [Account Linking](https://firebase.google.com/docs/auth/web/account-linking)

### Issue: Email Verification Not Working?

1. Go to **Authentication** > **Templates**
2. Click the **Email verification** template
3. Verify the "Sender name" and "Reply to" email address are correct
4. Check Gmail spam folder for test emails

---

## Code Integration

### AuthScreen Component Updates

The `AuthScreen.tsx` component has been updated to:

1. Import `signInWithEmail` and `signUpWithEmail` from `./lib/auth`
2. Use the structured error handling
3. Display user-friendly error messages in the toast/error banner

### Example Integration

```typescript
import { signInWithEmail, signUpWithEmail } from '../lib/auth';

const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const result = isSignUp
    ? await signUpWithEmail(email, password)
    : await signInWithEmail(email, password);

  if (!result.success) {
    setErrorMsg(result.errorMessage);
    return;
  }

  // User authenticated successfully
  onLogin({
    id: result.userCredential!.user.uid,
    email: result.userCredential!.user.email!,
    // ... rest of user session
  });
};
```

---

## Firebase Security Best Practices

### Password Requirements
- Minimum 6 characters (current demo setting)
- For production, consider requiring 12+ characters with special chars
- Configure in Firebase Console > Authentication > Sign-in method > Email/Password

### Session Management
- Firebase handles session persistence automatically
- Sessions expire after 24 hours of inactivity (configurable)
- Implement "Sign Out" to clear session

### Rate Limiting
- Firebase automatically rate-limits failed authentication attempts
- After 5 consecutive failed attempts, the user is locked out for 15 minutes
- No action required - handled by Firebase

### Email Verification (Optional)
For additional security, require users to verify their email:

```typescript
await firebaseUser.reload();
if (!firebaseUser.emailVerified) {
  await sendEmailVerification(firebaseUser);
  // Show message: "Verification email sent to your inbox"
}
```

---

## Next Steps

1. ✅ Enable Email/Password provider in Firebase Console
2. ✅ Hard refresh your application
3. ✅ Test sign-up with a valid email
4. ✅ Test sign-in with correct/incorrect credentials
5. ✅ Verify error messages are user-friendly (no raw Firebase errors)
6. ✅ Test from an incognito window (fresh session)
7. ✅ Configure additional security settings (optional but recommended)

---

## Support

- **Firebase Docs**: [https://firebase.google.com/docs/auth](https://firebase.google.com/docs/auth)
- **Firebase Community**: [https://stackoverflow.com/questions/tagged/firebase](https://stackoverflow.com/questions/tagged/firebase)
- **Your Application**: Check `src/lib/auth.ts` for detailed error handling logic
