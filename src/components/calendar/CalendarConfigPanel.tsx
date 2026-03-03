import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, Unlink, Loader2 } from 'lucide-react';
import { useCalendarConfig, type AvailabilitySlot } from '@/hooks/useCalendarConfig';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  userId: string;
}

export function CalendarConfigPanel({ userId }: Props) {
  const queryClient = useQueryClient();
  const { availability, config, googleStatus, isLoading, saveAvailability, saveConfig, DAYS } = useCalendarConfig(userId);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const callbackProcessed = useRef(false);

  // Handle Google OAuth callback
  useEffect(() => {
    if (callbackProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    callbackProcessed.current = true;

    // Clean URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    setIsProcessingCallback(true);
    supabase.functions.invoke('google-calendar-auth', {
      body: {
        action: 'callback',
        code,
        redirect_uri: window.location.origin + '/me',
      },
    }).then(resp => {
      if (resp.data?.success) {
        toast.success('Google Calendar conectado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      } else {
        toast.error('Erro ao conectar Google Calendar: ' + (resp.data?.error || 'Tente novamente'));
      }
    }).catch(() => {
      toast.error('Erro ao conectar Google Calendar');
    }).finally(() => {
      setIsProcessingCallback(false);
    });
  }, [queryClient]);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [duracao, setDuracao] = useState(config.duracao_minutos);
  const [buffer, setBuffer] = useState(config.buffer_minutos);
  const [maxDia, setMaxDia] = useState(config.max_por_dia);
  const [meetEnabled, setMeetEnabled] = useState(config.google_meet_enabled);

  useEffect(() => {
    if (availability.length > 0) {
      setSlots(availability);
    } else {
      setSlots([1, 2, 3, 4, 5].map(d => ({
        dia_semana: d,
        hora_inicio: '09:00',
        hora_fim: '18:00',
        ativo: true,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability.length]);

  useEffect(() => {
    setDuracao(config.duracao_minutos);
    setBuffer(config.buffer_minutos);
    setMaxDia(config.max_por_dia);
    setMeetEnabled(config.google_meet_enabled);
  }, [config.duracao_minutos, config.buffer_minutos, config.max_por_dia, config.google_meet_enabled]);

  const toggleDay = (dow: number) => {
    setSlots(prev => {
      const existing = prev.find(s => s.dia_semana === dow);
      if (existing) {
        return prev.map(s => s.dia_semana === dow ? { ...s, ativo: !s.ativo } : s);
      }
      return [...prev, { dia_semana: dow, hora_inicio: '09:00', hora_fim: '18:00', ativo: true }];
    });
  };

  const updateSlotTime = (dow: number, field: 'hora_inicio' | 'hora_fim', value: string) => {
    setSlots(prev => prev.map(s => s.dia_semana === dow ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    saveAvailability.mutate(slots.filter(s => s.ativo));
    saveConfig.mutate({ duracao_minutos: duracao, buffer_minutos: buffer, max_por_dia: maxDia, google_meet_enabled: meetEnabled });
  };

  const handleConnectGoogle = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Faça login primeiro'); return; }

    const redirectUri = `${window.location.origin}/me`;
    const resp = await supabase.functions.invoke('google-calendar-auth', {
      body: { action: 'get_auth_url', redirect_uri: redirectUri },
    });
    if (resp.data?.url) {
      window.location.href = resp.data.url;
    } else {
      toast.error('Erro ao obter URL de autorização');
    }
  };

  const handleDisconnectGoogle = async () => {
    await supabase.functions.invoke('google-calendar-auth', {
      body: { action: 'disconnect' },
    });
    toast.success('Google Calendar desconectado');
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Google Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isProcessingCallback ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Conectando Google Calendar...</span>
            </div>
          ) : googleStatus?.connected ? (
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Conectado
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDisconnectGoogle}>
                <Unlink className="h-3 w-3 mr-1" /> Desconectar
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnectGoogle} size="sm">
              <Calendar className="h-3 w-3 mr-1" /> Conectar Google Calendar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disponibilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((name, i) => {
            const slot = slots.find(s => s.dia_semana === i);
            return (
              <div key={i} className="flex items-center gap-3">
                <Switch checked={slot?.ativo ?? false} onCheckedChange={() => toggleDay(i)} />
                <span className="w-20 text-sm">{name}</span>
                {slot?.ativo && (
                  <>
                    <Input type="time" className="w-28" value={slot.hora_inicio} onChange={e => updateSlotTime(i, 'hora_inicio', e.target.value)} />
                    <span className="text-muted-foreground">-</span>
                    <Input type="time" className="w-28" value={slot.hora_fim} onChange={e => updateSlotTime(i, 'hora_fim', e.target.value)} />
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Meeting Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de Reunião</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <Input type="number" value={duracao} onChange={e => setDuracao(Number(e.target.value))} min={15} max={120} />
            </div>
            <div>
              <Label className="text-xs">Buffer (min)</Label>
              <Input type="number" value={buffer} onChange={e => setBuffer(Number(e.target.value))} min={0} max={60} />
            </div>
            <div>
              <Label className="text-xs">Máx/dia</Label>
              <Input type="number" value={maxDia} onChange={e => setMaxDia(Number(e.target.value))} min={1} max={20} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={meetEnabled} onCheckedChange={setMeetEnabled} />
            <Label className="text-sm">Google Meet automático</Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveAvailability.isPending || saveConfig.isPending} className="w-full">
        Salvar Configurações
      </Button>
    </div>
  );
}
