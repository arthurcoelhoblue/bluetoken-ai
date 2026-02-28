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
    // Check if already loaded
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
      // Zadarma returns { status: 'success', key: '...' }
      const key = data?.key;
      if (!key) throw new Error('No WebRTC key returned');
      return key as string;
    } catch (err) {
      console.error('[WebRTC] Failed to fetch key:', err);
      setError(err instanceof Error ? err.message : 'Erro ao obter chave WebRTC');
      return null;
    }
  }, [empresa, sipLogin]);

  // Initialize widget
  const initialize = useCallback(async () => {
    if (!empresa || !sipLogin || !enabled || initializedRef.current) return;

    setStatus('loading');
    setError(null);

    try {
      // 1. Fetch WebRTC key
      const key = await fetchKey();
      if (!key) {
        setStatus('error');
        return;
      }
      keyRef.current = key;

      // 2. Load Zadarma scripts
      await loadScript(SCRIPT_LIB);
      await loadScript(SCRIPT_FN);

      // 3. Wait for zadarmaWidgetFn to be available
      let attempts = 0;
      while (!window.zadarmaWidgetFn && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (!window.zadarmaWidgetFn) {
        throw new Error('zadarmaWidgetFn não carregou');
      }

      // 4. Initialize widget in hidden mode (false = invisible)
      window.zadarmaWidgetFn(key, sipLogin, 'rounded', 'pt', false, {right:'10px',bottom:'5px'});

      initializedRef.current = true;
      setStatus('ready');

      // 5. Schedule key refresh
      refreshTimerRef.current = setTimeout(async () => {
        const newKey = await fetchKey();
        if (newKey) {
          keyRef.current = newKey;
          // Re-initialize with new key
          if (window.zadarmaWidgetFn) {
            window.zadarmaWidgetFn(newKey, sipLogin, 'rounded', 'pt', false, {right:'10px',bottom:'5px'});
          }
        }
      }, KEY_REFRESH_MS);

    } catch (err) {
      console.error('[WebRTC] Init error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao inicializar WebRTC');
      setStatus('error');
    }
  }, [empresa, sipLogin, enabled, fetchKey]);

  // Listen for Zadarma widget events
  useEffect(() => {
    const handleWidgetEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      const eventType = detail.event || detail.type;
      console.log('[WebRTC] Widget event:', eventType, detail);

      switch (eventType) {
        case 'registered':
          setStatus('ready');
          break;
        case 'incoming':
        case 'ringing':
          setStatus('ringing');
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
          break;
      }
    };

    window.addEventListener('zadarmaWidgetEvent', handleWidgetEvent);
    return () => window.removeEventListener('zadarmaWidgetEvent', handleWidgetEvent);
  }, []);

  // Auto-initialize when params are ready
  useEffect(() => {
    if (enabled && empresa && sipLogin && !initializedRef.current) {
      initialize();
    }
  }, [enabled, empresa, sipLogin, initialize]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Programmatic dial via widget
  const dial = useCallback((number: string) => {
    if (status !== 'ready') {
      console.warn('[WebRTC] Cannot dial, status:', status);
      return;
    }
    setStatus('calling');
    // Dispatch event to Zadarma widget to initiate call
    const event = new CustomEvent('zadarmaWidgetEvent', {
      detail: { event: 'makeCall', number },
    });
    window.dispatchEvent(event);

    // Also try the iframe postMessage approach
    const iframe = document.querySelector('iframe[src*="zadarma"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ action: 'makeCall', number }),
        '*'
      );
    }
  }, [status]);

  const hangup = useCallback(() => {
    const event = new CustomEvent('zadarmaWidgetEvent', {
      detail: { event: 'hangup' },
    });
    window.dispatchEvent(event);

    const iframe = document.querySelector('iframe[src*="zadarma"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ action: 'hangup' }),
        '*'
      );
    }
    setStatus('ready');
  }, []);

  const answer = useCallback(() => {
    const event = new CustomEvent('zadarmaWidgetEvent', {
      detail: { event: 'answer' },
    });
    window.dispatchEvent(event);

    const iframe = document.querySelector('iframe[src*="zadarma"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ action: 'answer' }),
        '*'
      );
    }
  }, []);

  return {
    status,
    error,
    isReady: status === 'ready',
    dial,
    hangup,
    answer,
  };
}
