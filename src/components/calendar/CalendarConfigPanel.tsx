import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Video,
  Link2,
  Shield,
} from 'lucide-react';
import { useCalendarConfig, AvailabilitySlot } from '@/hooks/useCalendarConfig';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarConfigPanelProps {
  targetUserId?: string;
}

export function CalendarConfigPanel({ targetUserId }: CalendarConfigPanelProps) {
  const {
    availability, meetingConfig, calendarStatus, loading, saving, canEdit,
    isAdmin, isOwnProfile,
    addAvailabilitySlot, updateAvailabilitySlot, removeAvailabilitySlot,
    updateMeetingConfig, connectGoogleCalendar, disconnectGoogleCalendar,
  } = useCalendarConfig(targetUserId);

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({ dia_semana: 1, hora_inicio: '09:00', hora_fim: '12:00' });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddSlot = async () => {
    await addAvailabilitySlot({
      ...newSlot,
      user_id: targetUserId || '',
      ativo: true,
    });
    setShowAddSlot(false);
  };

  // Group availability by day
  const byDay: Record<number, AvailabilitySlot[]> = {};
  availability.forEach((s) => {
    if (!byDay[s.dia_semana]) byDay[s.dia_semana] = [];
    byDay[s.dia_semana].push(s);
  });

  return (
    <div className="space-y-6">
      {/* Google Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Conecte sua conta Google para sincronizar reuniões automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {calendarStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {calendarStatus.expired ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <div>
                  <p className="font-medium">{calendarStatus.google_email}</p>
                  <p className="text-sm text-muted-foreground">
                    {calendarStatus.expired ? 'Token expirado — reconecte' : 'Conectado'}
                  </p>
                </div>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={disconnectGoogleCalendar} disabled={saving}>
                  Desconectar
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Nenhuma conta Google conectada</p>
              {canEdit && (
                <Button onClick={connectGoogleCalendar} disabled={saving}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Conectar Google Calendar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Configuração de Reuniões
          </CardTitle>
          <CardDescription>
            Defina duração, buffer e preferências de reunião
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração (minutos)</Label>
              <Select
                value={String(meetingConfig?.duracao_minutos || 45)}
                onValueChange={(v) => canEdit && updateMeetingConfig({ duracao_minutos: Number(v) })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buffer entre reuniões (min)</Label>
              <Select
                value={String(meetingConfig?.intervalo_entre_reunioes || 15)}
                onValueChange={(v) => canEdit && updateMeetingConfig({ intervalo_entre_reunioes: Number(v) })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem buffer</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Antecedência mínima (horas)</Label>
              <Select
                value={String(meetingConfig?.antecedencia_minima_horas || 2)}
                onValueChange={(v) => canEdit && updateMeetingConfig({ antecedencia_minima_horas: Number(v) })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="8">8 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Antecedência máxima (dias)</Label>
              <Select
                value={String(meetingConfig?.antecedencia_maxima_dias || 14)}
                onValueChange={(v) => canEdit && updateMeetingConfig({ antecedencia_maxima_dias: Number(v) })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="21">21 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Google Meet automático</Label>
              <p className="text-sm text-muted-foreground">Criar link do Meet automaticamente ao agendar</p>
            </div>
            <Switch
              checked={meetingConfig?.google_meet_automatico ?? true}
              onCheckedChange={(v) => canEdit && updateMeetingConfig({ google_meet_automatico: v })}
              disabled={!canEdit}
            />
          </div>
          {meetingConfig?.aprovado_por && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Aprovado pelo gestor em {new Date(meetingConfig.aprovado_em!).toLocaleDateString('pt-BR')}
            </div>
          )}
          {isAdmin && !isOwnProfile && !meetingConfig?.aprovado_por && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMeetingConfig({})}
              disabled={saving}
            >
              <Shield className="h-4 w-4 mr-2" />
              Aprovar configuração
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Availability Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horários Disponíveis
              </CardTitle>
              <CardDescription>
                Defina quando a Amélia pode agendar reuniões
              </CardDescription>
            </div>
            {canEdit && (
              <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Horário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Dia da semana</Label>
                      <Select
                        value={String(newSlot.dia_semana)}
                        onValueChange={(v) => setNewSlot({ ...newSlot, dia_semana: Number(v) })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map((d, i) => (
                            <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Início</Label>
                        <Input
                          type="time"
                          value={newSlot.hora_inicio}
                          onChange={(e) => setNewSlot({ ...newSlot, hora_inicio: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim</Label>
                        <Input
                          type="time"
                          value={newSlot.hora_fim}
                          onChange={(e) => setNewSlot({ ...newSlot, hora_fim: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddSlot} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Adicionar Horário
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {availability.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum horário configurado. Adicione horários para a Amélia poder agendar reuniões.
            </p>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                const slots = byDay[dia];
                if (!slots?.length) return null;
                return (
                  <div key={dia} className="flex items-start gap-3">
                    <Badge variant="outline" className="min-w-[50px] justify-center mt-1">
                      {DIAS_CURTO[dia]}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <div
                          key={slot.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm ${
                            slot.ativo ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' : 'bg-muted opacity-50'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {slot.hora_inicio} - {slot.hora_fim}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => updateAvailabilitySlot(slot.id!, { ativo: !slot.ativo })}
                                className="ml-1 text-muted-foreground hover:text-foreground"
                                title={slot.ativo ? 'Desativar' : 'Ativar'}
                              >
                                {slot.ativo ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => removeAvailabilitySlot(slot.id!)}
                                className="text-muted-foreground hover:text-destructive"
                                title="Remover"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
