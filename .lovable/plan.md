

## Root Cause

The `google-calendar-auth` edge function is not registered in `supabase/config.toml`. All other functions have `verify_jwt = false` configured, but this one was never added.

Without this config entry, the default `verify_jwt = true` applies. The platform's signing-keys system rejects the JWT at the gateway level, so the function never executes. The edge function logs confirm this: only "booted" and "shutdown" entries, no request processing.

## Fix

Add one line to `supabase/config.toml`:

```toml
[functions.google-calendar-auth]
verify_jwt = false
```

This is the only change needed. The function already validates the JWT manually in its code (lines 19-22), so disabling gateway JWT verification is both safe and consistent with every other function in the project.

After this change, the function will be redeployed and the "Conectar Google Calendar" button should work in production.

