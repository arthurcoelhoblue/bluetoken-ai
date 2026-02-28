

# Fix: Multiple clicks hanging up the call

## Root cause

The logs show the sequence:
1. `incoming` → auto-click → `accepted` → `connected` (call connects successfully)
2. But then MutationObserver and staggered timeouts keep clicking the same button 3-4 more times
3. Clicking `zdrm-webphone-call-btn` after the call is connected **toggles/hangs up** the call

The staggered attempts (`setTimeout(attempt, 300)`, `setTimeout(attempt, 800)`, etc.) are all scheduled simultaneously and cannot be cancelled. The MutationObserver also fires independently, adding more clicks.

## Fix in `src/hooks/useZadarmaWebRTC.ts`

### 1. Add a ref to track if auto-answer succeeded
- `autoAnswerDoneRef = useRef(false)` — set to `true` on first successful click
- Check this ref in `clickAnswerButton()`, all `setTimeout` callbacks, and the MutationObserver before clicking

### 2. Stop all click attempts once `accepted`/`connected` is detected
- When console interceptor detects `accepted`/`confirmed`/`connected`, set `autoAnswerDoneRef.current = true`
- This prevents any queued timeouts or MutationObserver from clicking again

### 3. Reset the flag when a new call starts
- Reset `autoAnswerDoneRef.current = false` only in `triggerAutoAnswer()` at the start of a new incoming call

## Result
- First click answers the call → `accepted` → flag set → no more clicks → call stays connected

