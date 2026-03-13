import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EmpresaTipo } from '@/types/telephony';

declare global {
  interface Window {
    zadarmaWidgetFn?: (
      key: string,
      sipLogin: string,
      style: string,
      lang: string,
      visible: boolean,
      position: Record<string, string>
    ) => void;
  }
}

export type WebRTCStatus = 'idle' | 'loading' | 'ready' | 'error' | 'calling' | 'ringing' | 'active';

interface UseZadarmaWebRTCParams {
  empresa: EmpresaTipo | null;
  sipLogin: string | null;
  enabled?: boolean;
}

interface UseZadarmaWebRTCReturn {
  status: WebRTCStatus;
  error: string | null;
  isReady: boolean;
  dial: (number: string) => void;
  hangup: (callId?: string) => void;
  answer: () => void;
  setPendingOutbound: (pending: boolean) => void;
}

const SCRIPT_LIB = 'https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=1';
const SCRIPT_FN = 'https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=1';
const KEY_REFRESH_MS = 70 * 60 * 60 * 1000;
const HANGUP_COOLDOWN_MS = 3000;

const WIDGET_SELECTORS = [
  '[id*="zadarma"]', '[class*="zadarma"]',
  '[id*="webphone"]', '[class*="webphone"]',
  '[id*="phone_widget"]', '[class*="phone_widget"]',
  '[id*="phoneWidget"]', '[class*="phoneWidget"]',
  '[id*="webrtc_widget"]', '[class*="webrtc_widget"]',
  '[id*="sipPhone"]', '[class*="sipPhone"]',
  '[class*="zdrm"]', '[id*="zdrm"]',
  'iframe[src*="zadarma"]', 'iframe[src*="webphone"]',
  'iframe[src*="webrtc"]',
];

const SCRIPT_LOAD_TIMEOUT_MS = 30000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      console.log('[WebRTC] Script already loaded:', src);
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    const timeout = setTimeout(() => {
      console.error('[WebRTC] ⏰ Script load TIMEOUT after 30s:', src);
      script.remove();
      reject(new Error(`Script load timeout (30s): ${src}`));
    }, SCRIPT_LOAD_TIMEOUT_MS);

    script.onload = () => {
      clearTimeout(timeout);
      console.log('[WebRTC] ✅ Script loaded:', src);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      console.error('[WebRTC] ❌ Script failed to load:', src);
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function loadScriptWithRetry(src: string, retries = 1): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await loadScript(src);
      return;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[WebRTC] 🔄 Retrying script load (attempt ${attempt + 2}):`, src);
        const existing = document.querySelector(`script[src="${src}"]`);
        existing?.remove();
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

// Temporarily make all widget elements interactive (remove inert + unhide + move visible)
function enableWidgetInteraction() {
  const all = document.querySelectorAll(WIDGET_SELECTORS.join(','));
  all.forEach((el) => {
    if (el instanceof HTMLElement) {
      el.removeAttribute('inert');
      el.style.pointerEvents = 'auto';
      // Temporarily move to visible position so buttons render
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.opacity = '0.01';
      el.style.width = 'auto';
      el.style.height = 'auto';
    }
  });
}

// Re-disable widget interaction
function disableWidgetInteraction() {
  const all = document.querySelectorAll(WIDGET_SELECTORS.join(','));
  all.forEach((el) => {
    if (el instanceof HTMLElement) {
      el.setAttribute('inert', '');
      el.style.pointerEvents = 'none';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      el.style.opacity = '0';
      el.style.width = '1px';
      el.style.height = '1px';
    }
  });
}

// Try to answer via SIP.js session interception (Layer 1 — most reliable)
function tryAnswerViaSipSession(): boolean {
  try {
    // Zadarma v9 widget stores SIP UA on various global paths
    const candidates = [
      (window as any).__location_ua,
      (window as any).location_ua,
      (window as any).zadarmaUA,
      (window as any).ua,
      (window as any).sipUA,
      (window as any).phone,
    ];

    for (const ua of candidates) {
      if (!ua) continue;
      // JsSIP / SIP.js style UA
      const sessions = ua._sessions || ua.sessions;
      if (sessions && typeof sessions === 'object') {
        for (const key of Object.keys(sessions)) {
          const session = sessions[key];
          if (session && typeof session.answer === 'function' && session.direction === 'incoming') {
            console.log('[WebRTC] 🎯 Layer 1: Answering via SIP session.answer()');
            session.answer({ mediaConstraints: { audio: true, video: false } });
            return true;
          }
        }
      }
      // Alternative: rtcSession
      if (ua._rtcSession && typeof ua._rtcSession.answer === 'function') {
        console.log('[WebRTC] 🎯 Layer 1: Answering via UA._rtcSession.answer()');
        ua._rtcSession.answer({ mediaConstraints: { audio: true, video: false } });
        return true;
      }
    }

    // Also scan iframes for SIP sessions
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        const iframeWindow = iframe.contentWindow as any;
        if (!iframeWindow) return;
        const iframeCandidates = [
          iframeWindow.__location_ua,
          iframeWindow.location_ua,
          iframeWindow.zadarmaUA,
          iframeWindow.ua,
          iframeWindow.sipUA,
          iframeWindow.phone,
        ];
        for (const ua of iframeCandidates) {
          if (!ua) continue;
          const sessions = ua._sessions || ua.sessions;
          if (sessions && typeof sessions === 'object') {
            for (const key of Object.keys(sessions)) {
              const session = sessions[key];
              if (session && typeof session.answer === 'function' && session.direction === 'incoming') {
                console.log('[WebRTC] 🎯 Layer 1 (iframe): Answering via SIP session.answer()');
                session.answer({ mediaConstraints: { audio: true, video: false } });
                return;
              }
            }
          }
        }
      } catch { /* cross-origin */ }
    });
  } catch (err) {
    console.warn('[WebRTC] Layer 1 SIP session answer failed:', err);
  }
  return false;
}

// Click the answer/accept button inside the widget DOM (Layer 3)
function clickAnswerButton(): boolean {
  const selectors = [
    // Zadarma v9 specific
    '[class*="zdrm-webphone-accept"]',
    '[class*="zdrm-webphone-answer"]',
    '[class*="zdrm"][class*="accept-ico"]',
    '[class*="zdrm"][class*="answer-ico"]',
    '[class*="zdrm-ringing"] [class*="accept"]',
    '[class*="zdrm-ringing"] [class*="answer"]',
    '[class*="zdrm"] [class*="accept"]',
    '[class*="zdrm"] [class*="answer"]',
    '[class*="zdrm-webphone-call-accept"]',
    '[class*="zdrm-webphone-btn-accept"]',
    // v9 button patterns
    '.zdrm-webphone-in-call-accept',
    '.zdrm-webphone-ringing-accept',
    'button[class*="zdrm"][class*="green"]',
    'div[class*="zdrm"][class*="green"]',
    // Generic
    '.answer-btn',
    '.call-accept',
    '.btn-answer',
    '[data-action="answer"]',
    '[data-action="accept"]',
    'button[title*="answer" i]',
    'button[title*="accept" i]',
    'button[title*="ответить" i]',
    'button[title*="atender" i]',
  ];

  // Temporarily enable interaction and make visible
  enableWidgetInteraction();

  // Give browser a frame to render
  let clicked = false;

  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el instanceof HTMLElement) {
        const hadHide = el.classList.contains('zdrm-webphone-hide');
        if (hadHide) el.classList.remove('zdrm-webphone-hide');
        el.style.display = '';
        el.style.visibility = 'visible';

        el.click();
        console.log('[WebRTC] ✅ Layer 3: Auto-clicked answer button:', sel, el.className);

        if (hadHide) el.classList.add('zdrm-webphone-hide');
        clicked = true;
        break;
      }
    }
    if (clicked) break;
  }

  // Also try inside iframes (same-origin)
  if (!clicked) {
    document.querySelectorAll('iframe').forEach((iframe) => {
      if (clicked) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        for (const sel of selectors) {
          const btn = doc.querySelector(sel);
          if (btn instanceof HTMLElement) {
            const hadHide = btn.classList.contains('zdrm-webphone-hide');
            if (hadHide) btn.classList.remove('zdrm-webphone-hide');
            btn.style.display = '';
            btn.style.visibility = 'visible';
            btn.click();
            if (hadHide) btn.classList.add('zdrm-webphone-hide');
            console.log('[WebRTC] ✅ Layer 3 (iframe): Auto-clicked answer button:', sel);
            clicked = true;
            return;
          }
        }
      } catch { /* cross-origin */ }
    });
  }

  if (!clicked) {
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ action: 'answer' }), '*');
        iframe.contentWindow?.postMessage({ action: 'answer' }, '*');
      } catch { /* ignore */ }
    });
  }

  // Re-disable after a short delay to let the click register
  setTimeout(disableWidgetInteraction, 500);

  return clicked;
}

// Click the hangup/end-call button inside the widget DOM
function clickHangupButton(): boolean {
  const selectors = [
    '[class*="zdrm-webphone-hangup"]',
    '[class*="zdrm-webphone-reject"]',
    '[class*="zdrm-webphone-decline"]',
    '[class*="zdrm"][class*="hangup"]',
    '[class*="zdrm"][class*="end-call"]',
    '[class*="zdrm"][class*="reject"]',
    '[class*="zdrm"][class*="decline"]',
    '[class*="hangup"]',
    '[class*="end-call"]',
    '[class*="reject-call"]',
    '.hangup-btn',
    '.btn-hangup',
    '[data-action="hangup"]',
    '[data-action="reject"]',
    'button[title*="hangup" i]',
    'button[title*="end" i]',
    'button[title*="reject" i]',
  ];

  enableWidgetInteraction();

  let clicked = false;

  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el instanceof HTMLElement) {
        const hadHide = el.classList.contains('zdrm-webphone-hide');
        if (hadHide) el.classList.remove('zdrm-webphone-hide');
        el.click();
        if (hadHide) el.classList.add('zdrm-webphone-hide');
        console.log('[WebRTC] ✅ Clicked hangup button:', sel, el.className);
        clicked = true;
        break;
      }
    }
    if (clicked) break;
  }

  if (!clicked) {
    document.querySelectorAll('iframe').forEach((iframe) => {
      if (clicked) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        for (const sel of selectors) {
          const btn = doc.querySelector(sel);
          if (btn instanceof HTMLElement) {
            const hadHide = btn.classList.contains('zdrm-webphone-hide');
            if (hadHide) btn.classList.remove('zdrm-webphone-hide');
            btn.click();
            if (hadHide) btn.classList.add('zdrm-webphone-hide');
            console.log('[WebRTC] ✅ Clicked hangup button inside iframe:', sel);
            clicked = true;
            return;
          }
        }
      } catch { /* cross-origin */ }
    });
  }

  setTimeout(disableWidgetInteraction, 500);

  return clicked;
}

// Inject CSS to hide the native Zadarma widget UI
function injectHideCSS() {
  if (document.getElementById('zadarma-hide')) return;
  const style = document.createElement('style');
  style.id = 'zadarma-hide';
  style.textContent = `
    [id*="zadarma"], [class*="zadarma"],
    [id*="webphone"], [class*="webphone"],
    [id*="phone_widget"], [class*="phone_widget"],
    [id*="phoneWidget"], [class*="phoneWidget"],
    [id*="webrtc_widget"], [class*="webrtc_widget"],
    [id*="sipPhone"], [class*="sipPhone"],
    [class*="zdrm"], [id*="zdrm"],
    iframe[src*="zadarma"], iframe[src*="webphone"],
    iframe[src*="webrtc"] {
      position: fixed !important;
      left: -9999px !important;
      top: -9999px !important;
      width: 1px !important;
      height: 1px !important;
      opacity: 0 !important;
      overflow: hidden !important;
      z-index: -1 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Mark a widget element as inert
function markInert(el: HTMLElement) {
  el.setAttribute('inert', '');
  el.setAttribute('tabindex', '-1');
}

// Helper: check if status transition to 'active' is valid
function canTransitionToActive(current: WebRTCStatus): boolean {
  return current === 'calling' || current === 'ringing';
}

export function useZadarmaWebRTC({ empresa, sipLogin, enabled = true }: UseZadarmaWebRTCParams): UseZadarmaWebRTCReturn {
  const [status, setStatus] = useState<WebRTCStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const originalConsoleLog = useRef<typeof console.log>(console.log);
  const autoAnswerAttemptsRef = useRef(0);
  const autoAnswerDoneRef = useRef(false);
  const lastAutoAnswerTriggerRef = useRef(0);
  const incomingDetectedRef = useRef(false);
  const hangupCooldownRef = useRef(0);
  const callStartedAtRef = useRef<number>(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  // NEW: pendingOutbound flag — set when click_to_call is initiated
  // Allows auto-answer even if status isn't 'ready' yet (PBX callback ring)
  const pendingOutboundRef = useRef(false);

  const setPendingOutbound = useCallback((pending: boolean) => {
    pendingOutboundRef.current = pending;
    console.log('[WebRTC] 📌 pendingOutbound set to:', pending);
  }, []);

  // Guarded status setter — respects hangup cooldown
  const safeSetStatus = useCallback((newStatus: WebRTCStatus) => {
    if (Date.now() - hangupCooldownRef.current < HANGUP_COOLDOWN_MS) {
      if (newStatus === 'ready') {
        console.log('[WebRTC] ⏳ Cooldown: allowing transition to ready');
        setStatus('ready');
      } else {
        console.log('[WebRTC] 🛑 Cooldown active, blocking transition to:', newStatus);
      }
      return;
    }
    setStatus(newStatus);
  }, []);

  // Fetch WebRTC key
  const fetchKey = useCallback(async (): Promise<string | null> => {
    if (!empresa || !sipLogin) {
      console.warn('[WebRTC] fetchKey skipped — missing empresa or sipLogin', { empresa, sipLogin });
      return null;
    }
    console.log('[WebRTC] 🔑 Fetching WebRTC key...', { empresa, sipLogin });
    try {
      const { data, error: fnError } = await supabase.functions.invoke('zadarma-proxy', {
        body: { action: 'get_webrtc_key', empresa, payload: { sip_login: sipLogin } },
      });
      if (fnError) throw fnError;
      const key = data?.key;
      if (!key) throw new Error('No WebRTC key returned');
      console.log('[WebRTC] ✅ WebRTC key obtained successfully');
      return key as string;
    } catch (err) {
      console.error('[WebRTC] ❌ Failed to fetch key:', err);
      setError(err instanceof Error ? err.message : 'Erro ao obter chave WebRTC');
      return null;
    }
  }, [empresa, sipLogin]);

  // 3-layer auto-answer strategy
  const triggerAutoAnswer = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoAnswerTriggerRef.current < 2000) return;
    if (now - hangupCooldownRef.current < HANGUP_COOLDOWN_MS) {
      console.log('[WebRTC] 🛑 triggerAutoAnswer blocked by hangup cooldown');
      return;
    }

    // Allow auto-answer if status is ready OR if pendingOutbound is set
    const canAutoAnswer = statusRef.current === 'ready' || pendingOutboundRef.current;
    if (!canAutoAnswer) {
      console.log('[WebRTC] 🛑 triggerAutoAnswer blocked — status:', statusRef.current, 'pendingOutbound:', pendingOutboundRef.current);
      return;
    }

    lastAutoAnswerTriggerRef.current = now;
    autoAnswerAttemptsRef.current = 0;
    autoAnswerDoneRef.current = false;
    incomingDetectedRef.current = true;
    console.log('[WebRTC] 🟢 Triggering 3-layer auto-answer sequence...');
    safeSetStatus('ringing');

    // Layer 1: Try SIP.js session answer immediately
    if (tryAnswerViaSipSession()) {
      autoAnswerDoneRef.current = true;
      pendingOutboundRef.current = false;
      console.log('[WebRTC] ✅ Layer 1 succeeded (SIP session)');
      return;
    }

    // Layer 2: Dispatch zadarmaWidgetEvent to trigger answer
    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'answer' } }));
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ action: 'answer' }), '*');
        iframe.contentWindow?.postMessage({ action: 'answer' }, '*');
      } catch { /* ignore */ }
    });

    // Layer 3: Staggered DOM click attempts
    const attempt = () => {
      if (autoAnswerDoneRef.current) return;
      if (autoAnswerAttemptsRef.current >= 20) {
        console.warn('[WebRTC] ⚠️ Auto-answer: gave up after 20 attempts');
        pendingOutboundRef.current = false;
        return;
      }
      if (statusRef.current === 'active' || statusRef.current === 'ready') {
        pendingOutboundRef.current = false;
        return;
      }

      autoAnswerAttemptsRef.current++;

      // Re-try Layer 1 on each attempt
      if (tryAnswerViaSipSession()) {
        autoAnswerDoneRef.current = true;
        pendingOutboundRef.current = false;
        console.log('[WebRTC] ✅ Layer 1 succeeded on attempt', autoAnswerAttemptsRef.current);
        return;
      }

      // Layer 3: DOM click
      const clicked = clickAnswerButton();
      if (clicked) {
        autoAnswerDoneRef.current = true;
        pendingOutboundRef.current = false;
      } else {
        setTimeout(attempt, 500);
      }
    };

    setTimeout(attempt, 300);
  }, [safeSetStatus]);

  // Close active call record in DB when call ends locally (fallback for missing webhook)
  const closeActiveCallRecord = useCallback(async (explicitCallId?: string) => {
    const duracao = callStartedAtRef.current
      ? Math.round((Date.now() - callStartedAtRef.current) / 1000)
      : 0;
    callStartedAtRef.current = 0;

    const targetId = explicitCallId;
    if (!targetId && !empresa) return;

    try {
      let callId = targetId;

      if (!callId) {
        const { data: openCall, error: selectError } = await supabase
          .from('calls')
          .select('id')
          .eq('empresa', empresa!)
          .is('ended_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (selectError) { console.error('[WebRTC] Failed to find open call:', selectError); return; }
        if (!openCall) { console.log('[WebRTC] No open call record to close'); return; }
        callId = openCall.id;
      }

      if (duracao < 1 && !explicitCallId) return;

      const { error: updateError } = await supabase
        .from('calls')
        .update({
          ended_at: new Date().toISOString(),
          duracao_segundos: duracao,
          status: duracao > 0 ? 'ANSWERED' : 'MISSED',
        })
        .eq('id', callId);

      if (updateError) console.error('[WebRTC] Failed to close call record:', updateError);
      else console.log(`[WebRTC] ✅ Closed call record ${callId} locally (${duracao}s)`);
    } catch (err) {
      console.error('[WebRTC] Error closing call record:', err);
    }
  }, [empresa]);

  // console.log interceptor — EXPANDED keyword matching for v9
  useEffect(() => {
    if (!enabled) return;

    const origLog = originalConsoleLog.current;

    console.log = (...args: any[]) => {
      origLog.apply(console, args);

      const combined = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();

      // INCOMING: match Zadarma incoming-call patterns (expanded for v9)
      if (
        combined.includes('incomingcall') ||
        combined.includes('incoming call') ||
        combined.includes('invite received') ||
        combined.includes('newrtcsession') ||
        combined.includes('new rtcsession') ||
        combined.includes('peerconnection:recv') ||
        (combined.includes('incoming') && combined.includes('caller')) ||
        (combined.includes('incoming') && combined.includes('ringing')) ||
        (combined.includes('direction') && combined.includes('incoming'))
      ) {
        const canAutoAnswer = statusRef.current === 'ready' || pendingOutboundRef.current;
        if (canAutoAnswer) {
          origLog('[WebRTC] 📞 INCOMING detected via console.log intercept!');
          triggerAutoAnswer();
        }
      }
      // ACTIVE: match specific call-confirmed patterns WITH state guard
      else if (
        (combined.startsWith('confirmed') || combined.startsWith('accepted') ||
         combined.includes('call confirmed') || combined.includes('call accepted') ||
         combined.includes('in_call') || combined.includes('session confirmed') ||
         combined.includes('peerconnection:ready')) &&
        canTransitionToActive(statusRef.current)
      ) {
        origLog('[WebRTC] ✅ CALL ACTIVE detected via console.log');
        autoAnswerDoneRef.current = true;
        incomingDetectedRef.current = false;
        pendingOutboundRef.current = false;
        callStartedAtRef.current = Date.now();
        safeSetStatus('active');
      }
      // ENDED: match specific termination patterns
      else if (combined.includes('terminated') || combined.includes('call_end') || combined.includes('session ended') || combined.includes('call ended') || combined.startsWith('canceled')) {
        origLog('[WebRTC] 📴 CALL ENDED detected via console.log');
        closeActiveCallRecord();
        incomingDetectedRef.current = false;
        autoAnswerDoneRef.current = false;
        pendingOutboundRef.current = false;
        safeSetStatus('ready');
      }
      // SIP REGISTERED: only set ready if still loading (initial registration)
      else if (combined.includes('registered') && (combined.includes('sip') || combined.includes('phone') || combined.includes('webrtc'))) {
        origLog('[WebRTC] ✅ SIP Registered detected via console.log');
        if (statusRef.current === 'loading') safeSetStatus('ready');
      }
    };

    return () => {
      console.log = origLog;
    };
  }, [enabled, triggerAutoAnswer, safeSetStatus, closeActiveCallRecord]);

  // MutationObserver — handles CSS re-hiding + inert marking
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const id = node.id?.toLowerCase() || '';
          const cls = node.className?.toString?.()?.toLowerCase() || '';
          if (id.includes('zadarma') || id.includes('webphone') || id.includes('phone_widget') || id.includes('zdrm') ||
              cls.includes('zadarma') || cls.includes('webphone') || cls.includes('phone_widget') || cls.includes('zdrm')) {
            node.style.cssText = 'position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;z-index:-1!important;pointer-events:none!important;';
            markInert(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [enabled]);

  // zadarmaWidgetEvent listener (Layer 2 — event-based detection)
  useEffect(() => {
    if (!enabled) return;

    const handleWidgetEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const eventName = (detail.event || detail.type || '').toLowerCase();

      console.log('[WebRTC] 📡 zadarmaWidgetEvent received:', eventName, detail);

      if (eventName === 'incoming' || eventName === 'incomingcall' || eventName === 'ringing') {
        const canAutoAnswer = statusRef.current === 'ready' || pendingOutboundRef.current;
        if (canAutoAnswer) {
          triggerAutoAnswer();
        }
      } else if (eventName === 'confirmed' || eventName === 'accepted' || eventName === 'in_call') {
        if (canTransitionToActive(statusRef.current)) {
          callStartedAtRef.current = Date.now();
          pendingOutboundRef.current = false;
          safeSetStatus('active');
        }
      } else if (eventName === 'terminated' || eventName === 'ended' || eventName === 'hangup') {
        closeActiveCallRecord();
        pendingOutboundRef.current = false;
        safeSetStatus('ready');
      }
    };

    window.addEventListener('zadarmaWidgetEvent', handleWidgetEvent);
    return () => window.removeEventListener('zadarmaWidgetEvent', handleWidgetEvent);
  }, [enabled, triggerAutoAnswer, safeSetStatus, closeActiveCallRecord]);

  // postMessage listener — STRICT matching with state guards
  useEffect(() => {
    const handlePostMessage = (e: MessageEvent) => {
      let data: any = null;
      if (typeof e.data === 'string') {
        try { data = JSON.parse(e.data); } catch { /* not JSON */ }
      } else if (typeof e.data === 'object' && e.data !== null) {
        data = e.data;
      }
      if (!data) return;

      const combined = JSON.stringify(data).toLowerCase();

      if (combined.includes('incomingcall') || combined.includes('incoming call') || combined.includes('invite received') || combined.includes('newrtcsession')) {
        console.log('[WebRTC] 📞 INCOMING via postMessage!', data);
        triggerAutoAnswer();
      }
      else if (
        (combined.startsWith('confirmed') || combined.startsWith('accepted') ||
         combined.includes('call confirmed') || combined.includes('call accepted')) &&
        canTransitionToActive(statusRef.current)
      ) {
        callStartedAtRef.current = Date.now();
        pendingOutboundRef.current = false;
        safeSetStatus('active');
      }
      else if (combined.includes('terminated') || combined.includes('call ended') || combined.includes('session ended')) {
        closeActiveCallRecord();
        pendingOutboundRef.current = false;
        safeSetStatus('ready');
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [triggerAutoAnswer, safeSetStatus, closeActiveCallRecord]);

  // Initialize widget
  const initialize = useCallback(async () => {
    if (!empresa || !sipLogin || !enabled || initializedRef.current) {
      console.log('[WebRTC] initialize() skipped:', { empresa, sipLogin, enabled, initialized: initializedRef.current });
      return;
    }

    console.log('[WebRTC] 🚀 Starting initialization...', { empresa, sipLogin });
    setStatus('loading');
    setError(null);

    try {
      const key = await fetchKey();
      if (!key) {
        console.error('[WebRTC] ❌ No key obtained, aborting init');
        setStatus('error');
        return;
      }
      keyRef.current = key;

      console.log('[WebRTC] 📦 Loading Zadarma scripts...');
      await loadScriptWithRetry(SCRIPT_LIB, 1);
      await loadScriptWithRetry(SCRIPT_FN, 1);
      console.log('[WebRTC] ✅ Scripts loaded, waiting for zadarmaWidgetFn...');

      let attempts = 0;
      while (!window.zadarmaWidgetFn && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.zadarmaWidgetFn) {
        console.error('[WebRTC] ❌ zadarmaWidgetFn not available after 5s wait');
        throw new Error('zadarmaWidgetFn não carregou');
      }

      console.log('[WebRTC] ✅ zadarmaWidgetFn found, initializing widget...');
      injectHideCSS();
      window.zadarmaWidgetFn(key, sipLogin, 'rounded', 'pt', true, { right: '10px', bottom: '5px' });

      // Mark all existing widget elements as inert after a short delay
      setTimeout(() => {
        disableWidgetInteraction();
      }, 2000);

      initializedRef.current = true;
      console.log('[WebRTC] ✅ Widget initialized successfully!');
      setStatus('ready');

      refreshTimerRef.current = setTimeout(async () => {
        console.log('[WebRTC] 🔄 Refreshing WebRTC key...');
        const newKey = await fetchKey();
        if (newKey) {
          keyRef.current = newKey;
          window.zadarmaWidgetFn?.(newKey, sipLogin, 'rounded', 'pt', true, { right: '10px', bottom: '5px' });
        }
      }, KEY_REFRESH_MS);

    } catch (err) {
      console.error('[WebRTC] ❌ Init error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao inicializar WebRTC');
      setStatus('error');
    }
  }, [empresa, sipLogin, enabled, fetchKey]);

  // Auto-initialize
  useEffect(() => {
    if (enabled && empresa && sipLogin && !initializedRef.current) {
      initialize();
    }
  }, [enabled, empresa, sipLogin, initialize]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      observerRef.current?.disconnect();
    };
  }, []);

  const dial = useCallback((number: string) => {
    if (status !== 'ready') { console.warn('[WebRTC] Cannot dial, status:', status); return; }
    setStatus('calling');
    autoAnswerAttemptsRef.current = 0;
    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'makeCall', number } }));
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ action: 'makeCall', number }), '*');
      } catch { /* ignore */ }
    });
  }, [status]);

  const hangup = useCallback((callId?: string) => {
    console.log('[WebRTC] 🔴 hangup() called — setting cooldown and clicking widget hangup button...');
    hangupCooldownRef.current = Date.now();
    incomingDetectedRef.current = false;
    autoAnswerDoneRef.current = false;
    pendingOutboundRef.current = false;

    closeActiveCallRecord(callId);
    clickHangupButton();

    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'hangup' } }));
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ action: 'hangup' }), '*');
      } catch { /* ignore */ }
    });
    setStatus('ready');
  }, [closeActiveCallRecord]);

  const answer = useCallback(() => {
    triggerAutoAnswer();
  }, [triggerAutoAnswer]);

  return { status, error, isReady: status === 'ready', dial, hangup, answer, setPendingOutbound };
}
