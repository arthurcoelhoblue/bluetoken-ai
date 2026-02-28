import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EmpresaTipo } from '@/types/telephony';

// Zadarma widget global declarations
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
const KEY_REFRESH_MS = 70 * 60 * 60 * 1000; // 70 hours (key lasts 72h)

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export function useZadarmaWebRTC({ empresa, sipLogin, enabled = true }: UseZadarmaWebRTCParams): UseZadarmaWebRTCReturn {
  const [status, setStatus] = useState<WebRTCStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const autoAnswerAttemptedRef = useRef(false);

  // Fetch WebRTC key from proxy
  const fetchKey = useCallback(async (): Promise<string | null> => {
    if (!empresa || !sipLogin) return null;
    try {
      const { data, error: fnError } = await supabase.functions.invoke('zadarma-proxy', {
        body: {
          action: 'get_webrtc_key',
          empresa,
          payload: { sip_login: sipLogin },
        },
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

  // Auto-answer: multiple strategies to accept the incoming call
  const autoAnswer = useCallback(() => {
    if (autoAnswerAttemptedRef.current) return;
    autoAnswerAttemptedRef.current = true;
    console.log('[WebRTC] 🟢 Auto-answering incoming call...');

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const src = iframe.src || '';
      if (src.includes('zadarma') || src.includes('webphone') || src.includes('webrtc')) {
        try {
          // Strategy 1: JSON stringified action
          iframe.contentWindow?.postMessage(JSON.stringify({ action: 'answer' }), '*');
          // Strategy 2: plain object
          iframe.contentWindow?.postMessage({ action: 'answer' }, '*');
          // Strategy 3: command format
          iframe.contentWindow?.postMessage(JSON.stringify({ command: 'accept' }), '*');
          iframe.contentWindow?.postMessage({ command: 'accept' }, '*');
          // Strategy 4: Zadarma-specific event format
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'answer' }), '*');
          console.log('[WebRTC] Sent answer commands to iframe:', src.substring(0, 80));
        } catch (e) {
          console.warn('[WebRTC] Error sending to iframe:', e);
        }
      }
    });

    // Strategy 5: Try clicking the answer button if accessible
    iframes.forEach((iframe) => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const btn = doc.querySelector('[class*="answer"], [class*="accept"], .call-accept, .btn-answer, [data-action="answer"]');
        if (btn instanceof HTMLElement) {
          btn.click();
          console.log('[WebRTC] Clicked answer button inside iframe');
        }
      } catch { /* cross-origin expected */ }
    });

    // Reset after 5s so next call can auto-answer
    setTimeout(() => { autoAnswerAttemptedRef.current = false; }, 5000);
  }, []);

  // Initialize widget
  const initialize = useCallback(async () => {
    if (!empresa || !sipLogin || !enabled || initializedRef.current) return;

    setStatus('loading');
    setError(null);

    try {
      const key = await fetchKey();
      if (!key) {
        setStatus('error');
        return;
      }
      keyRef.current = key;

      await loadScript(SCRIPT_LIB);
      await loadScript(SCRIPT_FN);

      let attempts = 0;
      while (!window.zadarmaWidgetFn && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.zadarmaWidgetFn) {
        throw new Error('zadarmaWidgetFn não carregou');
      }

      // Initialize widget VISIBLE (true) so it can handle calls,
      // but we hide it with CSS overlay so user doesn't see native UI
      window.zadarmaWidgetFn(key, sipLogin, 'rounded', 'pt', true, {right:'10px',bottom:'5px'});

      // CSS overlay: hide native Zadarma UI but keep it functional
      const style = document.createElement('style');
      style.id = 'zadarma-hide';
      style.textContent = `
        [id*="zadarma"], [class*="zadarma"],
        iframe[src*="zadarma"], iframe[src*="webphone"] {
          position: fixed !important;
          right: -9999px !important;
          bottom: -9999px !important;
          width: 1px !important;
          height: 1px !important;
          opacity: 0.01 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        }
      `;
      if (!document.getElementById('zadarma-hide')) {
        document.head.appendChild(style);
      }

      initializedRef.current = true;
      setStatus('ready');

      // Schedule key refresh
      refreshTimerRef.current = setTimeout(async () => {
        const newKey = await fetchKey();
        if (newKey) {
          keyRef.current = newKey;
          if (window.zadarmaWidgetFn) {
            window.zadarmaWidgetFn(newKey, sipLogin, 'rounded', 'pt', true, {right:'10px',bottom:'5px'});
          }
        }
      }, KEY_REFRESH_MS);

    } catch (err) {
      console.error('[WebRTC] Init error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao inicializar WebRTC');
      setStatus('error');
    }
  }, [empresa, sipLogin, enabled, fetchKey]);

  // Listen for postMessage from Zadarma iframe (the REAL event channel)
  useEffect(() => {
    const handlePostMessage = (e: MessageEvent) => {
      // Parse message data
      let data: any = null;
      if (typeof e.data === 'string') {
        // Log ALL string messages for debug
        if (e.data.includes('zadarma') || e.data.includes('webphone') || e.data.includes('phone') || e.data.includes('call') || e.data.includes('incoming') || e.data.includes('ringing') || e.data.includes('answer') || e.data.includes('registered')) {
          console.log('[WebRTC] 📨 postMessage (string):', e.data.substring(0, 200));
        }
        try { data = JSON.parse(e.data); } catch { /* not JSON */ }
      } else if (typeof e.data === 'object' && e.data !== null) {
        data = e.data;
      }

      if (!data) return;

      // Log all structured messages from potential Zadarma sources
      const origin = e.origin || '';
      if (origin.includes('zadarma') || origin.includes('webphone')) {
        console.log('[WebRTC] 📨 postMessage from Zadarma:', JSON.stringify(data).substring(0, 300));
      }

      // Detect event type from various possible formats
      const eventType = data.event || data.action || data.command || data.type || data.state || data.status || '';
      const eventStr = typeof eventType === 'string' ? eventType.toLowerCase() : '';

      // Also check for nested data
      const nestedEvent = data.data?.event || data.data?.type || data.data?.state || '';
      const nestedStr = typeof nestedEvent === 'string' ? nestedEvent.toLowerCase() : '';

      const combined = eventStr + ' ' + nestedStr + ' ' + JSON.stringify(data).toLowerCase();

      if (combined.includes('incoming') || combined.includes('ringing') || combined.includes('invite')) {
        console.log('[WebRTC] 📞 INCOMING CALL DETECTED via postMessage!', data);
        setStatus('ringing');
        // Auto-answer with staggered attempts
        setTimeout(() => autoAnswer(), 300);
        setTimeout(() => autoAnswer(), 1000);
        setTimeout(() => autoAnswer(), 2000);
      } else if (combined.includes('confirmed') || combined.includes('accepted') || combined.includes('connected') || combined.includes('in_call')) {
        console.log('[WebRTC] ✅ CALL CONNECTED via postMessage');
        setStatus('active');
      } else if (combined.includes('ended') || combined.includes('terminated') || combined.includes('bye') || combined.includes('canceled') || combined.includes('failed')) {
        console.log('[WebRTC] 📴 CALL ENDED via postMessage');
        setStatus('ready');
        autoAnswerAttemptedRef.current = false;
      } else if (combined.includes('registered')) {
        console.log('[WebRTC] ✅ SIP Registered via postMessage');
        setStatus('ready');
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [autoAnswer]);

  // Also keep the CustomEvent listener as fallback
  useEffect(() => {
    const handleWidgetEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const eventType = detail.event || detail.type;
      if (eventType === 'answer' || eventType === 'makeCall' || eventType === 'hangup') return;
      console.log('[WebRTC] Widget CustomEvent:', eventType, detail);

      switch (eventType) {
        case 'registered':
          setStatus('ready');
          break;
        case 'incoming':
        case 'ringing':
          setStatus('ringing');
          setTimeout(() => autoAnswer(), 300);
          setTimeout(() => autoAnswer(), 1000);
          break;
        case 'confirmed':
        case 'accepted':
        case 'connected':
          setStatus('active');
          break;
        case 'ended':
        case 'terminated':
        case 'failed':
          setStatus('ready');
          autoAnswerAttemptedRef.current = false;
          break;
      }
    };

    window.addEventListener('zadarmaWidgetEvent', handleWidgetEvent);
    return () => window.removeEventListener('zadarmaWidgetEvent', handleWidgetEvent);
  }, [autoAnswer]);

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
    };
  }, []);

  // Dial
  const dial = useCallback((number: string) => {
    if (status !== 'ready') {
      console.warn('[WebRTC] Cannot dial, status:', status);
      return;
    }
    setStatus('calling');
    autoAnswerAttemptedRef.current = false; // Reset for this new call
    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'makeCall', number } }));
    const iframe = document.querySelector('iframe[src*="zadarma"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ action: 'makeCall', number }), '*');
    }
  }, [status]);

  const hangup = useCallback(() => {
    window.dispatchEvent(new CustomEvent('zadarmaWidgetEvent', { detail: { event: 'hangup' } }));
    const iframe = document.querySelector('iframe[src*="zadarma"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ action: 'hangup' }), '*');
    }
    setStatus('ready');
    autoAnswerAttemptedRef.current = false;
  }, []);

  const answer = useCallback(() => {
    autoAnswer();
  }, [autoAnswer]);

  return {
    status,
    error,
    isReady: status === 'ready',
    dial,
    hangup,
    answer,
  };
}
