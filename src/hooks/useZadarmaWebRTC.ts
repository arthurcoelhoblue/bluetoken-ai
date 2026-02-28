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
    // Zadarma v9: incoming call accept button (green icon with specific accept class)
    '[class*="zdrm-webphone-accept"]',
    '[class*="zdrm-webphone-answer"]',
    '[class*="zdrm"][class*="accept-ico"]',
    '[class*="zdrm"][class*="answer-ico"]',
    '[class*="zdrm-ringing"] [class*="accept"]',
    '[class*="zdrm-ringing"] [class*="answer"]',
    // Generic fallbacks — only use very specific selectors
    '.answer-btn',
    '.call-accept',
    '.btn-answer',
    '[data-action="answer"]',
    '[data-action="accept"]',
    'button[title*="answer" i]',
    'button[title*="accept" i]',
  ];

  // First pass: only click visible (non-hidden) elements
  let fallbackEl: HTMLElement | null = null;
  let fallbackSel = '';
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      console.log(`[WebRTC] 🔍 Selector "${sel}" found ${els.length} element(s)`);
    }
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

  // Fallback: click hidden element as last resort
  if (fallbackEl) {
    fallbackEl.click();
    console.log('[WebRTC] ⚠️ Fallback: clicked hidden answer button:', fallbackSel, fallbackEl.className);
    return true;
  }

  // Strategy: also send postMessage to any Zadarma iframe
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ action: 'answer' }), '*');
      iframe.contentWindow?.postMessage({ action: 'answer' }, '*');
      iframe.contentWindow?.postMessage(JSON.stringify({ command: 'accept' }), '*');
      iframe.contentWindow?.postMessage({ command: 'accept' }, '*');
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

  // First pass: only click visible (non-hidden) elements
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

  // Try inside iframes
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

  // Fallback: click hidden element as last resort
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
    /* Hide Zadarma widget - aggressive selectors including zdrm-* */
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
      /* NO pointer-events:none — auto-click needs it functional */
    }
  `;
  document.head.appendChild(style);
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

  const statusRef = useRef(status);
  statusRef.current = status;

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

  // Auto-answer: staggered click attempts (debounced — ignores calls within 2s)
  const triggerAutoAnswer = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoAnswerTriggerRef.current < 2000) {
      console.log('[WebRTC] ⏳ triggerAutoAnswer debounced (called within 2s)');
      return;
    }
    lastAutoAnswerTriggerRef.current = now;
    autoAnswerAttemptsRef.current = 0;
    autoAnswerDoneRef.current = false;
    incomingDetectedRef.current = true;
    console.log('[WebRTC] 🟢 Triggering auto-answer sequence...');
    setStatus('ringing');

    const attempt = () => {
      if (autoAnswerDoneRef.current) {
        console.log('[WebRTC] ✅ Auto-answer already done, skipping further attempts');
        return;
      }
      if (autoAnswerAttemptsRef.current >= 10) {
        console.warn('[WebRTC] ⚠️ Auto-answer: gave up after 10 attempts');
        return;
      }
      if (statusRef.current === 'active' || statusRef.current === 'ready') return;

      autoAnswerAttemptsRef.current++;
      const clicked = clickAnswerButton();
      if (clicked) {
        autoAnswerDoneRef.current = true;
        console.log('[WebRTC] 🔒 Auto-answer done flag set, no more clicks');
      } else {
        setTimeout(attempt, 500);
      }
    };

    setTimeout(attempt, 500);
  }, []);

  // console.log interceptor to detect widget events
  useEffect(() => {
    if (!enabled) return;

    const origLog = originalConsoleLog.current;

    console.log = (...args: any[]) => {
      origLog.apply(console, args);

      // Check if any arg contains Zadarma-relevant keywords
      const combined = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ').toLowerCase();

      if (combined.includes('incoming') || combined.includes('incomingcall')) {
        origLog('[WebRTC] 📞 INCOMING detected via console.log intercept!');
        triggerAutoAnswer();
      } else if (combined.includes('confirmed') || combined.includes('accepted') || combined.includes('in_call')) {
        origLog('[WebRTC] ✅ CALL ACTIVE detected via console.log');
        autoAnswerDoneRef.current = true;
        incomingDetectedRef.current = false;
        setStatus('active');
      } else if (combined.includes('terminated') || combined.includes('canceled') || combined.includes('bye') || combined.includes('call_end')) {
        origLog('[WebRTC] 📴 CALL ENDED detected via console.log');
        incomingDetectedRef.current = false;
        autoAnswerDoneRef.current = false;
        setStatus('ready');
      } else if (combined.includes('registered') && (combined.includes('sip') || combined.includes('phone') || combined.includes('webrtc'))) {
        origLog('[WebRTC] ✅ SIP Registered detected via console.log');
        if (statusRef.current === 'loading') setStatus('ready');
      }
    };

    return () => {
      console.log = origLog;
    };
  }, [enabled, triggerAutoAnswer]);

  // MutationObserver to detect answer button appearing
  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          const html = node.outerHTML?.toLowerCase() || '';
          // Detect if the added element looks like an answer/incoming UI
          // Only care about elements that could be answer UI (not SCRIPT, VIDEO, AUDIO tags)
          const tag = node.tagName;
          if (tag === 'SCRIPT' || tag === 'VIDEO' || tag === 'AUDIO' || tag === 'LINK' || tag === 'STYLE') {
            // Skip non-interactive elements, just re-hide if needed
          } else if (html.includes('accept') || html.includes('incoming') || html.includes('ringing')) {
            console.log('[WebRTC] 🔍 MutationObserver: potential answer element detected', tag, node.className);
            // Only auto-click if an incoming call was actually detected
            if (incomingDetectedRef.current && !autoAnswerDoneRef.current) {
              setTimeout(() => {
                if (incomingDetectedRef.current && !autoAnswerDoneRef.current) {
                  const clicked = clickAnswerButton();
                  if (clicked) {
                    autoAnswerDoneRef.current = true;
                    incomingDetectedRef.current = false;
                  }
                }
              }, 200);
            }
          }

          // Also re-apply CSS hiding for any new widget elements
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

  // postMessage listener (keep as fallback)
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
      if (combined.includes('incoming') || combined.includes('ringing') || combined.includes('invite')) {
        console.log('[WebRTC] 📞 INCOMING via postMessage!', data);
        triggerAutoAnswer();
      } else if (combined.includes('confirmed') || combined.includes('accepted') || combined.includes('connected')) {
        setStatus('active');
      } else if (combined.includes('ended') || combined.includes('terminated') || combined.includes('bye') || combined.includes('canceled')) {
        setStatus('ready');
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [triggerAutoAnswer]);

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

      // Inject CSS BEFORE initializing widget
      injectHideCSS();

      // Init widget visible=true (required for functionality)
      window.zadarmaWidgetFn(key, sipLogin, 'rounded', 'pt', true, { right: '10px', bottom: '5px' });

      initializedRef.current = true;
      setStatus('ready');

      // Schedule key refresh
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
    console.log('[WebRTC] 🔴 hangup() called — clicking widget hangup button...');
    clickHangupButton();

    // Fallback: postMessage + CustomEvent
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
