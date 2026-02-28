import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, X, Minimize2, Maximize2, Pause, Play, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMyExtension, useZadarmaProxy } from '@/hooks/useZadarma';
import { useZadarmaWebRTC } from '@/hooks/useZadarmaWebRTC';
import { CoachingSidebar } from './CoachingSidebar';
import type { EmpresaTipo } from '@/types/telephony';
import type { DialEvent, PhoneWidgetState } from '@/types/telephony';

const DIALPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function ZadarmaPhoneWidget() {
  const { profile } = useAuth();
  const { activeCompany } = useCompany();
  const empresa = activeCompany as EmpresaTipo;
  const { data: myExtension, isLoading: isLoadingExtension } = useMyExtension(empresa, profile?.id ?? null);

  const sipLogin = myExtension?.sip_login ?? null;
  const isWebRTCMode = !!sipLogin;

  // WebRTC hook — only active when sip_login is configured
  const webrtc = useZadarmaWebRTC({
    empresa,
    sipLogin,
    enabled: isWebRTCMode,
  });

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

  // Sync WebRTC status to phone state
  useEffect(() => {
    if (!isWebRTCMode) return;
    switch (webrtc.status) {
      case 'calling':
        setPhoneState('dialing');
        break;
      case 'ringing':
        setPhoneState('ringing');
        break;
      case 'active':
        setPhoneState('active');
        break;
    }
  }, [webrtc.status, isWebRTCMode]);

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
    console.log('[ZadarmaWidget] handleDial called', { number, empresa, myExtension, isWebRTCMode, webrtcReady: webrtc.isReady });
    try {
      if (!number.trim() || !empresa || !myExtension) {
        console.warn('[ZadarmaWidget] handleDial guard failed:', { number: number.trim(), empresa, myExtension, hasExtension });
        if (!number.trim()) toast.error('Digite um número para ligar.');
        else if (!empresa) toast.error('Nenhuma empresa ativa selecionada.');
        else if (!myExtension) toast.error('Ramal não encontrado. Recarregue a página.');
        return;
      }
      setCallTimer(0);
      setOnHold(false);

      if (isWebRTCMode && webrtc.isReady) {
        setPhoneState('dialing');
        webrtc.dial(number);
        toast.info('Iniciando chamada via WebRTC...');
      } else {
        setPhoneState('dialing');
        toast.info('Iniciando chamada...');
        proxy.mutate({
          action: 'click_to_call',
          empresa,
          payload: { from: myExtension.extension_number, to: number },
        }, {
          onSuccess: (data) => {
            console.log('[ZadarmaWidget] click_to_call success:', data);
            toast.success('Callback solicitado. Atenda seu ramal para conectar a chamada.');
          },
          onError: (error) => {
            console.error('[ZadarmaWidget] click_to_call error:', error);
            toast.error('Erro ao iniciar chamada: ' + (error instanceof Error ? error.message : String(error)));
            setPhoneState('idle');
          },
          onSettled: (data, error) => {
            console.log('[ZadarmaWidget] click_to_call settled', { data, error });
          },
        });
      }
    } catch (err) {
      console.error('[ZadarmaWidget] handleDial exception:', err);
      toast.error('Erro inesperado ao iniciar chamada.');
      setPhoneState('idle');
    }
  }, [number, empresa, myExtension, proxy, isWebRTCMode, webrtc]);

  const handleHangup = useCallback(() => {
    if (isWebRTCMode) {
      webrtc.hangup();
    }
    setPhoneState('ended');
    setOnHold(false);
    setMaximized(false);
    setTimeout(() => {
      setPhoneState('idle');
      setCallTimer(0);
    }, 2000);
  }, [isWebRTCMode, webrtc]);

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

  // Mode badge component
  const ModeBadge = () => {
    if (!hasExtension) return null;
    if (isWebRTCMode) {
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-success/50 text-success gap-1">
          <Wifi className="h-2.5 w-2.5" />
          WebRTC
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-warning/50 text-warning gap-1">
        <WifiOff className="h-2.5 w-2.5" />
        Callback
      </Badge>
    );
  };

  const dialingLabel = isWebRTCMode ? 'Chamando...' : 'Atenda seu ramal';

  // Minimized FAB
  if (minimized && !number) {
    if (isLoadingExtension) return null;
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

  // Call info shared between compact and maximized
  const CallInfo = () => (
    <>
      <div className="text-center">
        <p className="text-lg font-semibold">{contactName || number}</p>
        {contactName && <p className="text-sm text-muted-foreground">{number}</p>}
        {dealId && <p className="text-xs text-muted-foreground mt-1">Deal vinculado</p>}
      </div>
      {onHold && (
        <p className="text-xs text-warning font-medium animate-pulse">Em espera</p>
      )}
      <p className={`text-2xl font-mono ${phoneState === 'dialing' ? 'animate-pulse text-warning' : phoneState === 'ended' ? 'text-destructive' : 'text-success'}`}>
        {phoneState === 'dialing' ? dialingLabel : phoneState === 'ended' ? 'Encerrada' : formatTimer(callTimer)}
      </p>
    </>
  );

  const CallControls = () => (
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
  );

  // Maximized with coaching sidebar
  if (maximized && isInCall) {
    return (
      <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-3xl h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex overflow-hidden">
          <div className="w-72 shrink-0 border-r border-border flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="text-sm font-medium">Telefonia</span>
                <ModeBadge />
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setMaximized(false)}>
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <CallInfo />
              <CallControls />
            </div>
          </div>
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
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span className="text-sm font-medium">Telefonia</span>
          <ModeBadge />
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

      {isInCall ? (
        <div className="p-6 text-center space-y-4">
          <CallInfo />
          <CallControls />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* WebRTC status indicator */}
          {isWebRTCMode && webrtc.status === 'loading' && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">Conectando WebRTC...</p>
          )}
          {isWebRTCMode && webrtc.status === 'error' && (
            <p className="text-xs text-destructive text-center">
              WebRTC indisponível. Usando callback.
              {webrtc.error && <span className="block text-[10px]">{webrtc.error}</span>}
            </p>
          )}
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
          {isLoadingExtension ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando ramal...</p>
            </div>
          ) : !hasExtension ? (
            <p className="text-sm text-destructive text-center py-2">
              Nenhum ramal configurado. Solicite ao administrador a configuração do seu ramal em <strong>Configurações &gt; Zadarma</strong>.
            </p>
          ) : (
            <Button
              className="w-full gap-2"
              disabled={!number.trim() || proxy.isPending || (isWebRTCMode && webrtc.status === 'loading')}
              onClick={handleDial}
            >
              <Phone className="h-4 w-4" />
              {isWebRTCMode && webrtc.isReady ? 'Ligar (WebRTC)' : 'Ligar'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
