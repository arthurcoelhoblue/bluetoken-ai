

## Fix CORS for Custom Domain `ameliacrm.com.br`

### Problem
`isAllowedOrigin` in `supabase/functions/_shared/cors.ts` only allows `.lovable.app` and `.lovableproject.com` origins, blocking requests from the production custom domain `ameliacrm.com.br`.

### Changes

**File: `supabase/functions/_shared/cors.ts`**

Replace the current `isAllowedOrigin` function (lines 12-14) with:

```typescript
const ALLOWED_ORIGINS = [
  "https://ameliacrm.com.br",
  "https://www.ameliacrm.com.br",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return origin.endsWith('.lovable.app') || origin.endsWith('.lovableproject.com');
}
```

**Then redeploy** all edge functions that import `getCorsHeaders` from this shared module. Based on the codebase, this includes all frontend-facing functions (google-calendar-auth, calendar-book, calendar-slots, call-coach, sgt-buscar-lead, and others).

