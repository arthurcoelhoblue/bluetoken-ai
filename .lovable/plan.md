

# Fix: WebRTC Auto-Answer Not Triggering

## Root Cause

The console.log interceptor (line 315) uses overly strict keyword matching that doesn't match the actual Zadarma v9 log format.

**What Zadarma logs:** `incoming {"caller": "+55...", "callername": "", "calledDid": ""}`

**What the interceptor matches:** `incomingcall`, `incoming call`, `invite received`

The combined string becomes `incoming {"caller":"..."...}` which contains `incoming` but none of the matched patterns. The previous fix to prevent false activations was too aggressive and broke the legitimate incoming call detection.

## Fix

In `src/hooks/useZadarmaWebRTC.ts`, line 315:

Add a pattern that matches standalone `incoming` when it appears with `caller` (the Zadarma-specific incoming call log format). This is safe because:
- SIP registration logs use `registered` and `connected`, never `incoming`
- The word `incoming` with `caller` is unambiguous — it's always an actual call

```typescript
// Before:
if (combined.includes('incomingcall') || combined.includes('incoming call') || combined.includes('invite received'))

// After:
if (combined.includes('incomingcall') || combined.includes('incoming call') || combined.includes('invite received') || (combined.includes('incoming') && combined.includes('caller')))
```

Single line change in `src/hooks/useZadarmaWebRTC.ts`.

