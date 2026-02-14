import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, X, Minimize2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMyExtension, useZadarmaProxy } from '@/hooks/useZadarma';
import type { EmpresaTipo } from '@/types/telephony';
import type { DialEvent, PhoneWidgetState } from '@/types/telephony';

const DIALPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function ZadarmaPhoneWidget() {
  const { profile } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany === 'ALL' ? null : activeCompany as EmpresaTipo | null;
  const { data: myExtension } = useMyExtension(empresa, profile?.id ?? null);

  const [minimized, setMinimized] = useState(true);
  const [phoneState, setPhoneState] = useState<PhoneWidgetState>('idle');
  const [number, setNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [dealId, setDealId] = useState<string | undefined>();
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const proxy = useZadarmaProxy();

  // Listen for dial events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DialEvent>).detail;
      setNumber(detail.number);
      setContactName(detail.contactName || '');
      setDealId(detail.dealId);
      setMinimized(false);
      setPhoneState('idle');
    };
    window.addEventListener('bluecrm:dial', handler);
    return () => window.removeEventListener('bluecrm:dial', handler);
  }, []);

  // Call timer
  useEffect(() => {
    if (phoneState !== 'active') return;
    const interval = setInterval(() => setCallTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [phoneState]);

  const handleDial = useCallback(() => {
    if (!number.trim() || !empresa || !myExtension) return;
    setPhoneState('dialing');
    setCallTimer(0);
    setOnHold(false);

    proxy.mutate({
      action: 'click_to_call',
      empresa,
      payload: { from: myExtension.extension_number, to: number },
    }, {
      onSuccess: () => setPhoneState('active'),
      onError: () => setPhoneState('idle'),
    });
  }, [number, empresa, myExtension, proxy]);

  const handleHangup = () => {
    setPhoneState('ended');
    setOnHold(false);
    setTimeout(() => {
      setPhoneState('idle');
      setCallTimer(0);
    }, 2000);
  };

  const handleHold = () => {
    if (!empresa || !myExtension) return;
    setOnHold(prev => !prev);
    proxy.mutate({
      action: onHold ? 'unhold' : 'hold',
      empresa,
      payload: { extension: myExtension.extension_number },
    });
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Don't render if user has no extension
  if (!myExtension) return null;

  // Minimized state — floating FAB
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
      >
        <Phone className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl bg-card border border-border shadow-lg overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span className="text-sm font-medium">Telefonia</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMinimized(true)}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMinimized(true)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Active call state */}
      {(phoneState === 'dialing' || phoneState === 'active' || phoneState === 'ended') ? (
        <div className="p-6 text-center space-y-4">
          <div>
            <p className="text-lg font-semibold">{contactName || number}</p>
            {contactName && <p className="text-sm text-muted-foreground">{number}</p>}
          </div>
          {onHold && (
            <p className="text-xs text-warning font-medium animate-pulse">Em espera</p>
          )}
          <p className={`text-2xl font-mono ${phoneState === 'dialing' ? 'animate-pulse text-warning' : phoneState === 'ended' ? 'text-destructive' : 'text-success'}`}>
            {phoneState === 'dialing' ? 'Discando...' : phoneState === 'ended' ? 'Encerrada' : formatTimer(callTimer)}
          </p>
          <div className="flex items-center justify-center gap-3">
            {phoneState === 'active' && (
              <>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setMuted(!muted)}>
                  {muted ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" className={`h-10 w-10 rounded-full ${onHold ? 'bg-warning/20 border-warning' : ''}`} onClick={handleHold}>
                  {onHold ? <Play className="h-4 w-4 text-warning" /> : <Pause className="h-4 w-4" />}
                </Button>
              </>
            )}
            {phoneState !== 'ended' && (
              <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={handleHangup}>
                <PhoneOff className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Idle — Dialpad */
        <div className="p-4 space-y-3">
          <Input
            value={number}
            onChange={e => setNumber(e.target.value)}
            placeholder="Número de telefone"
            className="text-center text-lg font-mono"
          />
          <div className="grid grid-cols-3 gap-1.5">
            {DIALPAD.map(key => (
              <Button
                key={key}
                variant="outline"
                className="h-10 text-lg font-medium"
                onClick={() => setNumber(n => n + key)}
              >
                {key}
              </Button>
            ))}
          </div>
          <Button
            className="w-full gap-2"
            disabled={!number.trim() || proxy.isPending}
            onClick={handleDial}
          >
            <Phone className="h-4 w-4" />
            Ligar
          </Button>
        </div>
      )}
    </div>
  );
}
