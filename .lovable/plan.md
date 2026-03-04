

## Audit: Edge Functions Missing from config.toml

### Root Cause (same as the Google Calendar fix)

When a function directory exists but has no entry in `supabase/config.toml`, the platform defaults to `verify_jwt = true`. The signing-keys system then rejects the JWT at the gateway level, and the function never executes. The frontend receives "Failed to send a request to the Edge Function".

### 12 Functions Missing from config.toml

These function directories exist but have NO config entry:

| # | Function | Purpose |
|---|----------|---------|
| 1 | `admin-create-user` | Admin user creation |
| 2 | `admin-provision-tenant` | Tenant provisioning |
| 3 | `calendar-book` | Calendar booking |
| 4 | `calendar-slots` | Available calendar slots |
| 5 | `cs-ai-actions` | CS AI actions (suggest-note, churn-predict) |
| 6 | `cs-scheduled-jobs` | CS scheduled jobs (daily-briefing, nps-auto) |
| 7 | `elementor-webhook` | Elementor form webhook |
| 8 | `follow-up-scheduler` | Follow-up scheduling |
| 9 | `icp-learner` | ICP learning |
| 10 | `meeting-transcription` | Meeting transcription |
| 11 | `notify-closer` | Closer notifications |
| 12 | `sync-renewal-triggers` | Renewal trigger sync |

### 13 Ghost Entries (in config but no directory)

These config entries reference functions that don't exist as directories. They're harmless but should be cleaned up:

`bluechat-inbound`, `bluechat-proxy`, `cs-renewal-alerts`, `cs-incident-detector`, `cs-nps-auto`, `cs-daily-briefing`, `cs-churn-predictor`, `cs-trending-topics`, `cs-suggest-note`, `sdr-message-parser`, `sdr-intent-classifier`, `sdr-response-generator`, `sdr-action-executor`

### Fix

**One change to `supabase/config.toml`:**
- Add all 12 missing functions with `verify_jwt = false`
- Remove the 13 ghost entries (optional cleanup)

**Then redeploy** any of the 12 functions that were previously failing.

This is the exact same issue that broke Google Calendar -- just replicated across 12 more functions.

