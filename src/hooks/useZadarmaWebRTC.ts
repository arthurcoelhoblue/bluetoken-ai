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
  hangup: () => void;
  answer: () => void;
}

const SCRIPT_LIB = 'https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=1';
const SCRIPT_FN = 'https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=1';
const KEY_REFRESH_MS = 70 * 60 * 60 * 1000;
const HANGUP_COOLDOWN_MS = 3000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Click the answer/accept button inside the widget DOM
function clickAnswerButton(): boolean {
  // IMPORTANT: Only target ANSWER/ACCEPT buttons for incoming calls.
  // Do NOT use [class*="zdrm-webphone-call-btn"] — that matches the DIAL button too!
  const selectors = [
    '[class*="zdrm-webphone-accept"]',
    '[class*="zdrm-webphone-answer"]',
    '[class*="zdrm"][class*="accept-ico"]',
    '[class*="zdrm"][class*="answer-ico"]',
    '[class*="zdrm-ringing"] [class*="accept"]',
    '[class*="zdrm-ringing"] [class*="answer"]',
    '.answer-btn',
    '.call-accept',
    '.btn-answer',
    '[data-action="answer"]',
    '[data-action="accept"]',
    'button[title*="answer" i]',
    'button[title*="accept" i]',
  ];

  let fallbackEl: HTMLElement | null = null;
  let fallbackSel = '';
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el instanceof HTMLElement) {
        if (el.classList.contains('zdrm-webphone-hide')) {
          if (!fallbackEl) { fallbackEl = el; fallbackSel = sel; }
          continue;
        }
        el.click();
        console.log('[WebRTC] ✅ Auto-clicked answer button:', sel, el.className);
        return true;
      }
    }
  }

  // Also try inside iframes (same-origin)
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      for (const sel of selectors) {
        const btn = doc.querySelector(sel);
        if (btn instanceof HTMLElement) {
          if (btn.classList.contains('zdrm-webphone-hide')) continue;
          btn.click();
          console.log('[WebRTC] ✅ Auto-clicked answer button inside iframe:', sel);
          return;
        }
      }
    } catch { /* cross-origin */ }
  });

  if (fallbackEl) {
    fallbackEl.click();
    console.log('[WebRTC] ⚠️ Fallback: clicked hidden answer button:', fallbackSel, fallbackEl.className);
    return true;
  }

  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ action: 'answer' }), '*');
      iframe.contentWindow?.postMessage({ action: 'answer' }, '*');
    } catch { /* ignore */ }
  });

  return false;
}

// Click the hangup/end-call button inside the widget DOM
function clickHangupButton(): boolean {
  const selectors = [
    '[class*="zdrm-webphone-hangup"]',
    '[class*="zdrm-webphone-reject"]',
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

  let fallbackEl: HTMLElement | null = null;
  let fallbackSel = '';
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el instanceof HTMLElement) {
        if (el.classList.contains('zdrm-webphone-hide')) {
          if (!fallbackEl) { fallbackEl = el; fallbackSel = sel; }
          continue;
        }
        el.click();
        console.log('[WebRTC] ✅ Clicked hangup button:', sel, el.className);
        return true;
      }
    }
  }

  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      for (const sel of selectors) {
        const btn = doc.querySelector(sel);
        if (btn instanceof HTMLElement) {
          if (btn.classList.contains('zdrm-webphone-hide')) continue;
          btn.click();
          console.log('[WebRTC] ✅ Clicked hangup button inside iframe:', sel);
          return;
        }
      }
    } catch { /* cross-origin */ }
  });

  if (fallbackEl) {
    fallbackEl.click();
    console.log('[WebRTC] ⚠️ Fallback: clicked hidden hangup button:', fallbackSel, fallbackEl.className);
    return true;
  }

  return false;
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
    }
  `;
  document.head.appendChild(style);
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

  const statusRef = useRef(status);
  statusRef.current = status;

  // Guarded status setter — respects hangup cooldown
  const safeSetStatus = useCallback((newStatus: WebRTCStatus) => {
    if (Date.now() - hangupCooldownRef.current < HANGUP_COOLDOWN_MS) {
      // During cooldown, only allow 'ready' (from SIP re-registration)
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
    if (!empresa || !sipLogin) return null;
    try {
      const { data, error: fnError } = await supabase.functions.invoke('zadarma-proxy', {
        body: { action: 'get_webrtc_key', empresa, payload: { sip_login: sipLogin } },
      });
      if (fnError) throw fnError;
      const key = data?.key;
      if (!key) throw new Error('No WebRTC key returned');
      return key as string;
    } catch (err) {
      console.error('[WebRTC] Failed to fetch key:', err);
      setError(err instanceof Error ? err.message : 'Erro ao obter chave WebRTC');
      return null;
    }
  }, [empresa, sipLogin]);

  // Auto-answer: staggered click attempts (debounced)
  const triggerAutoAnswer = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoAnswerTriggerRef.current < 2000) return;
    if (now - hangupCooldownRef.current < HANGUP_COOLDOWN_MS) {
      console.log('[WebRTC] 🛑 triggerAutoAnswer blocked by hangup cooldown');
      return;
    }
    lastAutoAnswerTriggerRef.current = now;
    autoAnswerAttemptsRef.current = 0;
    autoAnswerDoneRef.current = false;
    incomingDetectedRef.current = true;
    console.log('[WebRTC] 🟢 Triggering auto-answer sequence...');
    safeSetStatus('ringing');

    const attempt = () => {
      if (autoAnswerDoneRef.current) return;
      if (autoAnswerAttemptsRef.current >= 10) {
        console.warn('[WebRTC] ⚠️ Auto-answer: gave up after 10 attempts');
        return;
      }
      if (statusRef.current === 'active' || statusRef.current === 'ready') return;

      autoAnswerAttemptsRef.current++;
      const clicked = clickAnswerButton();
      if (clicked) {
        autoAnswerDoneRef.current = true;
      } else {
        setTimeout(attempt, 500);
      }
    };

    setTimeout(attempt, 500);
  }, [safeSetStatus]);

  // console.log interceptor — STRICT keyword matching
  useEffect(() => {
    if (!enabled) return;

    const origLog = originalConsoleLog.current;

    console.log = (...args: any[]) => {
      origLog.apply(console, args);

      const combined = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();

      // INCOMING: only match specific Zadarma incoming-call patterns
      if (combined.includes('incomingcall') || combined.includes('incoming call') || combined.includes('invite received') || (combined.includes('incoming') && combined.includes('caller'))) {
        origLog('[WebRTC] 📞 INCOMING detected via console.log intercept!');
        triggerAutoAnswer();
      }
      // ACTIVE: only match specific call-confirmed patterns, WITH state guard
      else if (
        (combined.includes('call confirmed') || combined.includes('call accepted') || combined.includes('in_call') || combined.includes('session confirmed')) &&
        canTransitionToActive(statusRef.current)
      ) {
        origLog('[WebRTC] ✅ CALL ACTIVE detected via console.log');
        autoAnswerDoneRef.current = true;
        incomingDetectedRef.current = false;
        safeSetStatus('active');
      }
      // ENDED: match specific termination patterns
      else if (combined.includes('terminated') || combined.includes('call_end') || combined.includes('session ended') || combined.includes('call ended')) {
        origLog('[WebRTC] 📴 CALL ENDED detected via console.log');
        incomingDetectedRef.current = false;
        autoAnswerDoneRef.current = false;
        safeSetStatus('ready');
      }
      // SIP REGISTERED: only set ready if still loading (initial registration)
      else if (combined.includes('registered') && (combined.includes('sip') || combined.includes('phone') || combined.includes('webrtc'))) {
        origLog('[WebRTC] ✅ SIP Registered detected via console.log');
        if (statusRef.current === 'loading') safeSetStatus('ready');
      }
      // NOTE: 'connected', 'confirmed', 'accepted', 'canceled', 'bye' as bare words are IGNORED
      // They fire during SIP registration and would cause false state transitions
    };

    return () => {
      console.log = origLog;
    };
  }, [enabled, triggerAutoAnswer, safeSetStatus]);

  // MutationObserver — ONLY handles CSS re-hiding, NO auto-click logic
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          // Re-apply CSS hiding for any new widget elements
          const id = node.id?.toLowerCase() || '';
          const cls = node.className?.toString?.()?.toLowerCase() || '';
          if (id.includes('zadarma') || id.includes('webphone') || id.includes('phone_widget') || id.includes('zdrm') ||
              cls.includes('zadarma') || cls.includes('webphone') || cls.includes('phone_widget') || cls.includes('zdrm')) {
            node.style.cssText = 'position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;z-index:-1!important;';
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [enabled]);

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

      // INCOMING: specific patterns only
      if (combined.includes('incomingcall') || combined.includes('incoming call') || combined.includes('invite')) {
        console.log('[WebRTC] 📞 INCOMING via postMessage!', data);
        triggerAutoAnswer();
      }
      // ACTIVE: with state guard — NO 'connected' match
      else if (
        (combined.includes('call confirmed') || combined.includes('call accepted')) &&
        canTransitionToActive(statusRef.current)
      ) {
        safeSetStatus('active');
      }
      // ENDED: specific patterns
      else if (combined.includes('terminated') || combined.includes('call ended') || combined.includes('session ended')) {
        safeSetStatus('ready');
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [triggerAutoAnswer, safeSetStatus]);

  // Initialize widget
  const initialize = useCallback(async () => {
    if (!empresa || !sipLogin || !enabled || initializedRef.current) return;

    setStatus('loading');
    setError(null);

    try {
      const key = await fetchKey();
      if (!key) { setStatus('error'); return; }
      keyRef.current = key;

      await loadScript(SCRIPT_LIB);
      await loadScript(SCRIPT_FN);

      let attempts = 0;
      while (!window.zadarmaWidgetFn && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.zadarmaWidgetFn) throw new Error('zadarmaWidgetFn não carregou');

      injectHideCSS();
      window.zadarmaWidgetFn(key, sipLogin, 'rounded', 'pt', true, { right: '10px', bottom: '5px' });

      initializedRef.current = true;
      setStatus('ready');

      refreshTimerRef.current = setTimeout(async () => {
        const newKey = await fetchKey();
        if (newKey) {
          keyRef.current = newKey;
          window.zadarmaWidgetFn?.(newKey, sipLogin, 'rounded', 'pt', true, { right: '10px', bottom: '5px' });
        }
      }, KEY_REFRESH_MS);

    } catch (err) {
      console.error('[WebRTC] Init error:', err);
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

  const hangup = useCallback(() => {
    console.log('[WebRTC] 🔴 hangup() called — setting cooldown and clicking widget hangup button...');
    // Set cooldown BEFORE clicking — blocks any false transitions from SIP re-registration
    hangupCooldownRef.current = Date.now();
    incomingDetectedRef.current = false;
    autoAnswerDoneRef.current = false;

    clickHangupButton();

    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'hangup' } }));
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(JSON.stringify({ action: 'hangup' }), '*');
      } catch { /* ignore */ }
    });
    setStatus('ready');
  }, []);

  const answer = useCallback(() => {
    triggerAutoAnswer();
  }, [triggerAutoAnswer]);

  return { status, error, isReady: status === 'ready', dial, hangup, answer };
}
