# Prod Sign-In Broken: Existing Email Shows "First & Last Name"

**Status:** Resolved on 2026-10-31.

**Investigated:** 2026-10-31, read-only. No deploy ran and no prod setting was changed during this investigation.

**Resolved by:** Turning off email enumeration protection (see Resolution).

## Answer In One Line

We did not deploy anything that broke login. Prod has served the same June 1 build since June 1. A Firebase Auth console change on Oct 10, 2026 (enabling email enumeration protection) broke the old FirebaseUI sign-in flow.

## TL;DR

- Prod hosting is unchanged since **2026-06-01**. The last prod tag is `26.06.01`, and the live bundle still reports `last-modified: Mon, 01 Jun 2026 21:58:40 GMT`.
- That build uses **FirebaseUI 6.1.0** for sign-in.
- FirebaseUI's email-first flow calls `fetchSignInMethodsForEmail(email)` to decide "existing account" vs "new account".
- On **2026-10-10T22:18:14Z**, the Firebase project config for `lecoursville` was changed to set `emailPrivacyConfig.enableImprovedEmailPrivacy = true` (email enumeration protection).
- With that setting on, `fetchSignInMethodsForEmail` returns an empty list for every email, including real accounts.
- FirebaseUI then takes its `passwordSignUp` branch and renders the **"Create account"** page, which contains the field labelled **"First & last name"**.
- Result: entering a known email looks like a new sign-up instead of asking for the password.

## Resolution

Fixed on 2026-10-31 by the site owner: **Email enumeration protection was set to Off** in the Firebase console for project `lecoursville`.

- No code was deployed, and prod hosting remains the June 1 build.
- No user accounts were changed.
- Sign-in with a known email now asks for the password instead of showing "First & last name".
- The setting is expected to stay off until the queued version (native email and password form) is deployed and verified.
- After that deploy, re-enable email enumeration protection and re-verify sign-in.

## Evidence

### Prod has not been redeployed

- `https://lecoursville.com/index.html` header: `last-modified: Mon, 01 Jun 2026 21:58:40 GMT`.
- Live bundle: `main.eead6797788cff8c.js` and `styles.76e0d3af4295628d.css`.
- Live bundle contains `firebaseui` (659 occurrences), `"Create account"`, and `First &amp; last name` with `id="ui-sign-in-name-input"`.
- Live bundle Firebase config: `projectId:"lecoursville"`, `authDomain:"lecoursville.firebaseapp.com"`.
- Last git tag is `26.06.01` (commit `8c34f3a4`, 2026-06-01 17:57 -0400). `scripts/deploy.sh` tags every prod deploy, so no prod deploy has happened after that tag.
- No prod deploy exists in the reflog after 2026-06-01.

### The old flow depends on sign-in-method lookup

Production bundle logic (FirebaseUI 6.1.0):

```js
function r9(a,p,_,A,D,k){
  _.length                                 // sign-in methods returned
    ? pr(_, cn.Z.auth.EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD)
        ? pn("passwordSignIn", ...)        // existing account -> password
        : ...
    : ...                                  // empty -> falls through to sign-up
}
```

The name field lives on the sign-up page:

```html
<h1 class="firebaseui-title">Create account</h1>
...
<label ... for="ui-sign-in-name-input">First &amp; last name</label>
```

So "First & last name" is proof the app chose `passwordSignUp`, which only happens when the sign-in-method lookup came back empty.

### The config change that caused it

Config at investigation time, before the fix (`GET https://identitytoolkit.googleapis.com/admin/v2/projects/lecoursville/config`, read-only):

```json
{
  "subtype": "IDENTITY_PLATFORM",
  "signIn": { "email": { "enabled": true, "passwordRequired": true } },
  "client": { "permissions": {} },
  "emailPrivacyConfig": { "enableImprovedEmailPrivacy": true }
}
```

Audit log (read-only, Cloud Audit Logs):

| Time (UTC) | Action | Actor |
|---|---|---|
| 2026-10-10T22:17:41Z | `EnableIdentityPlatform` | efournier92@gmail.com |
| 2026-10-10T22:18:14Z | `UpdateConfig`, updateMask includes `emailPrivacyConfig.enableImprovedEmailPrivacy` | efournier92@gmail.com |
| 2026-10-10T22:31:26Z | `UpdateConfig` (email templates) | efournier92@gmail.com |
| 2026-10-10T22:37:11Z | `UpdateDefaultSupportedIdpConfig` (google.com enabled) | service account |

This was a console action on the Firebase and Identity Platform project, not a code deploy. The `subtype: IDENTITY_PLATFORM` value shows the project was upgraded to Identity Platform during the same session.

### Why it surfaced later than Oct 10

The June build keeps sessions in local storage and silent refresh. Users who stayed signed in never saw the sign-in screen. Enabling Identity Platform and changing config can invalidate refresh tokens. Once a session was forced back to the login screen, the broken email-first path was exposed.

## Quick Fix (No Deploy)

Turn off email enumeration protection. It is a single toggle and takes effect immediately; no build or deploy is needed.

1. Open the Firebase console for project `lecoursville`.
2. Go to **Authentication**, then **Settings**.
3. Find **Email enumeration protection** (labelled **Improved email privacy** in the Identity Platform settings API).
4. Set it to **Off** and save.
5. In a private window, open `https://lecoursville.com`, enter a known account email, and confirm the flow now asks for the password instead of showing "First & last name".

Tradeoff: with the toggle off, the client can probe whether an email is registered. For a private family site this is an acceptable temporary state.

Do not change any user records. No accounts were deleted and no passwords need resetting. The accounts are intact; the app simply cannot see which emails have accounts.

### API Equivalent, Only If You Approve It

This is a production write. Do not run it as part of this investigation.

```bash
TOKEN=$(firebase login:list >/dev/null; gcloud auth print-access-token)  # use any admin OAuth token with project access
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/lecoursville/config?updateMask=emailPrivacyConfig.enableImprovedEmailPrivacy" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emailPrivacyConfig":{"enableImprovedEmailPrivacy":false}}'
```

## Permanent Fix

The queued big version no longer uses FirebaseUI. `master` (and the `2026-10-30_Feedback` branch) implement a native email and password form:

- `src/app/services/auth.service.ts:72` calls `signInWithEmailAndPassword(this.firebase.auth, email, password)`.
- `src/app/components/auth/auth.component.html` renders explicit Email and Password inputs plus a generic error banner.
- `fetchSignInMethodsForEmail` is not used anywhere in `src/`.

So after the queued version is deployed and verified, the sign-in flow no longer depends on the privacy setting, and email enumeration protection can be turned back on.

Recommended sequence:

1. Apply the Quick Fix now so sign-in works tonight. Done on 2026-10-31.
2. Ship the queued version through the normal gate and sign-off.
3. Verify sign-in with the new build.
4. Re-enable email enumeration protection, then verify sign-in again.

## Verification Commands (Read-Only)

```bash
# Confirm prod is still the June build
curl -sSI https://lecoursville.com/ | grep -i last-modified

# Inspect the live project auth config (requires a logged-in firebase CLI token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  https://identitytoolkit.googleapis.com/admin/v2/projects/lecoursville/config \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["subtype"]); print(d["emailPrivacyConfig"])'
```

Expected after the quick fix: `{"enableImprovedEmailPrivacy": false}`.

## What Not To Do

- Do not redeploy from the wrong branch. Prod deploys must come from `master`, and `scripts/deploy.sh` enforces this.
- Do not reset, delete, or recreate user accounts. They are not the problem.
- Do not "fix" this by disabling email and password sign-in.
- Do not force a redeploy of the June build hoping it changes behavior. It is the same code and will reproduce the same symptom.

## Related

- Commit `be76cbd0` "Give the sign-in gate a real not-found state and entry CTA" introduced the native sign-in form used by the new version.
- Commit `5ceb2c46` "Gate Membership Behind Admin Approval" added custom claims and approval gating in the new version; unrelated to this break, but it is part of the queued deploy.
