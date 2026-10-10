# 10. Auth flows don't reveal whether an account exists; email must be verified

- Status: Accepted
- Source: `src/utils/auth.ts`, `src/pages/{register,login,forgot-password}.astro`

## Context

Registration, sign-in and password reset can each leak whether an email address is registered. Accounts with unverified addresses would allow spam submissions under someone else's address.

## Decision

- `requireEmailVerification: true`: users can't sign in before they verify their email. Links are valid for 1 h, and verifying signs the user in automatically.
- There is no separate resend page. A sign-in attempt by an unverified user sends a new link (`sendOnSignIn: true`), and the login page says so on `EMAIL_NOT_VERIFIED`. better-auth checks the password first, so this state is only shown to someone who knows the password.
- Sign-up with an existing email returns the same success response as a new sign-up. better-auth does this automatically when `requireEmailVerification` is on.
- Forgot-password **always shows the same success message**, whether or not the account exists.
- These pages are `Disallow`ed in `robots.txt`.

## Consequences

- Turning off `requireEmailVerification` would bring back sign-up enumeration (`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), on top of allowing unverified accounts.
- New account-related flows (e.g. change email, invite) must follow the same rule: no response may differ by whether an account exists.
- E2E tests that need an account without content use the pre-verified seed user `clean@example.com`. They don't register a fresh one.
