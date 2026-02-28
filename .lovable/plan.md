

# Bug Analysis: Phone Widget Auto-Activating

## Root Cause

The bug has **two interacting causes**:

### 1. Console.log interceptor catches SIP registration events as call events

The logs show this sequence after hangup:
```
[WebRTC] 🔴 hangup() called
[WebRTC] ✅ Clicked hangup button
...
BROWSER_SUPPORTED undefined
registered undefined
connected undefined
```

The words `registered` and `connected` are logged by the Zadarma widget during normal SIP registration (not a call). But:

- **Line 314**: The console.log interceptor matches `confirmed`/`accepted`/`in_call` and sets status to `active`
- **Line 398**: The postMessage handler matches `confirmed`/`accepted`/`connected` and sets status to `active`

When the widget logs `connected` during SIP re-registration after hangup, the postMessage or console interceptor catches it and sets the phone state to `active` — restarting the timer, speech recognition, and the entire call UI.

### 2. MutationObserver fires on static widget DOM

The log `[WebRTC] 🔍 MutationObserver: potential answer element detected DIV` fires because the Zadarma widget's DOM contains elements with words like `accept`/`ringing` as part of its static structure. Even with the `incomingDetectedRef` guard, the observer keeps logging and checking.

## The Fix

### A. Add state guards to prevent false `active` transitions

Only transition to `active` from states that make sense (`calling`, `ringing`, `dialing`). Never from `ready` or `idle`.

### B. Make keyword matching much stricter

- `connected` alone should NOT match — it's a SIP registration event
- Only match exact Zadarma call event strings like `CONFIRMED`, `incomingCall`, `TERMINATED`
- The `registered` keyword should only set `ready`, never trigger call logic

### C. Disable MutationObserver answer-click logic entirely

The auto-answer via MutationObserver is the most dangerous part. The `incomingDetectedRef` guard helps but the observer still reacts to widget DOM mutations during init/hangup. Replace it with a simpler approach: only use the console.log interceptor for incoming detection, and only attempt auto-answer from `triggerAutoAnswer`.

### D. Reset state atomically on hangup

When `hangup()` is called, set a `hangupCooldownRef` that blocks any status transitions for 3 seconds, preventing the SIP re-registration events from re-activating the call UI.

## Files to Edit

| File | Change |
|------|--------|
| `src/hooks/useZadarmaWebRTC.ts` | Fix console.log interceptor keywords, add state guards, add hangup cooldown, simplify MutationObserver |

## Implementation Details

### Console.log interceptor (lines 305-327)
- Change `confirmed`/`accepted`/`in_call` check to only match specific patterns like `call confirmed` or `call accepted`, NOT bare words
- Add guard: only set `active` if current status is `calling` or `ringing`
- Add hangup cooldown check

### PostMessage handler (lines 384-407)
- Remove `connected` from the active-state triggers
- Add same state guards as console.log interceptor

### MutationObserver (lines 336-381)
- Remove the auto-click logic entirely from the observer — it should only handle CSS re-hiding
- The `triggerAutoAnswer` function (called from console.log/postMessage interceptors) already handles click attempts

### Hangup function (lines 484-496)
- Set a `hangupCooldownRef = Date.now()` before clicking hangup
- In all status transition points, check if `Date.now() - hangupCooldownRef < 3000` and skip if true

