import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, X, Minimize2, Maximize2, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMyExtension, useZadarmaProxy } from '@/hooks/useZadarma';
import { CoachingSidebar } from './CoachingSidebar';
import type { EmpresaTipo } from '@/types/telephony';
import type { DialEvent, PhoneWidgetState } from '@/types/telephony';

const DIALPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function ZadarmaPhoneWidget() {
  const { profile } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany as EmpresaTipo;
  const { data: myExtension } = useMyExtension(empresa, profile?.id ?? null);

  const [minimized, setMinimized] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const [phoneState, setPhoneState] = useState<PhoneWidgetState>('idle');
  const [number, setNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [dealId, setDealId] = useState<string | undefined>();
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const proxy = useZadarmaProxy();

  // Listen for dial events — must be before any early return
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
      onSuccess: () => {
        // Callback was accepted — stay in 'dialing' state until webhook confirms.
        // Don't auto-transition to 'active' since the call hasn't connected yet.
        toast.info('Callback solicitado. Atenda seu ramal para conectar a chamada.');
      },
      onError: (error) => {
        toast.error('Erro ao iniciar chamada. Verifique se a telefonia está ativa para esta empresa.');
        console.error('Dial error:', error);
        setPhoneState('idle');
      },
    });
  }, [number, empresa, myExtension, proxy]);

  const handleHangup = () => {
    setPhoneState('ended');
    setOnHold(false);
    setMaximized(false);
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

  const hasExtension = !!myExtension;

  // Minimized FAB — only show if has extension and no pending dial
  if (minimized && !number) {
    if (!hasExtension) return null;
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-6 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
      >
        <Phone className="h-5 w-5" />
      </button>
    );
  }

  // If dial was triggered but minimized, expand
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-6 z-[60] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 animate-pulse"
      >
        <Phone className="h-5 w-5" />
      </button>
    );
  }

  const isInCall = phoneState === 'dialing' || phoneState === 'active' || phoneState === 'ended';
  const showCoaching = maximized && phoneState === 'active';

  // Maximized with coaching sidebar
  if (maximized && isInCall) {
    return (
      <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-3xl h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex overflow-hidden">
          {/* Phone panel */}
          <div className="w-72 shrink-0 border-r border-border flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="text-sm font-medium">Telefonia</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMaximized(false)}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Call info */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="text-center">
                <p className="text-lg font-semibold">{contactName || number}</p>
                {contactName && <p className="text-sm text-muted-foreground">{number}</p>}
                {dealId && <p className="text-xs text-muted-foreground mt-1">Deal vinculado</p>}
              </div>
              {onHold && (
                <p className="text-xs text-warning font-medium animate-pulse">Em espera</p>
              )}
          <p className={`text-2xl font-mono ${phoneState === 'dialing' ? 'animate-pulse text-warning' : phoneState === 'ended' ? 'text-destructive' : 'text-success'}`}>
                {phoneState === 'dialing' ? 'Atenda seu ramal' : phoneState === 'ended' ? 'Encerrada' : formatTimer(callTimer)}
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
          </div>

          {/* Coaching sidebar */}
          <div className="flex-1 min-w-0">
            <CoachingSidebar dealId={dealId} isActive={showCoaching} />
          </div>
        </div>
      </div>
    );
  }

  // Normal compact widget
  return (
    <div className="fixed bottom-20 right-6 z-[60] w-72 rounded-2xl bg-card border border-border shadow-lg overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span className="text-sm font-medium">Telefonia</span>
        </div>
        <div className="flex items-center gap-1">
          {isInCall && phoneState === 'active' && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMaximized(true)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMinimized(true)}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMinimized(true)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Active call state */}
      {isInCall ? (
        <div className="p-6 text-center space-y-4">
          <div>
            <p className="text-lg font-semibold">{contactName || number}</p>
            {contactName && <p className="text-sm text-muted-foreground">{number}</p>}
          </div>
          {onHold && (
            <p className="text-xs text-warning font-medium animate-pulse">Em espera</p>
          )}
          <p className={`text-2xl font-mono ${phoneState === 'dialing' ? 'animate-pulse text-warning' : phoneState === 'ended' ? 'text-destructive' : 'text-success'}`}>
            {phoneState === 'dialing' ? 'Atenda seu ramal' : phoneState === 'ended' ? 'Encerrada' : formatTimer(callTimer)}
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
          {!hasExtension ? (
            <p className="text-sm text-destructive text-center py-2">
              Nenhum ramal configurado. Solicite ao administrador a configuração do seu ramal em <strong>Configurações &gt; Zadarma</strong>.
            </p>
          ) : (
            <Button
              className="w-full gap-2"
              disabled={!number.trim() || proxy.isPending}
              onClick={handleDial}
            >
              <Phone className="h-4 w-4" />
              Ligar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
