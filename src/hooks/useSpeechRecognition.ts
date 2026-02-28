import { useRef, useState, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  getAndResetChunk: () => string;
  isListening: boolean;
  isSupported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const recognitionRef = useRef<any>(null);
  const chunkRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const shouldBeListeningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;

  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            chunkRef.current += (chunkRef.current ? ' ' : '') + text;
          }
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if should still be listening (browsers kill long sessions ~60s)
      if (shouldBeListeningRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldBeListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch {
              // already started or disposed
            }
          }
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[SpeechRecognition] error:', event.error);
      // 'no-speech' is normal, 'aborted' happens on stop — don't treat as fatal
      if (event.error === 'not-allowed' || event.error === 'service-not-available') {
        shouldBeListeningRef.current = false;
        setIsListening(false);
      }
      // other errors: onend will fire and auto-restart
    };

    return recognition;
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;
    shouldBeListeningRef.current = true;

    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // already started
      }
    }
  }, [isSupported, createRecognition]);

  const stop = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const getAndResetChunk = useCallback(() => {
    const chunk = chunkRef.current;
    chunkRef.current = '';
    return chunk;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { start, stop, getAndResetChunk, isListening, isSupported };
}
