import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { generalSettingsSchema, type GeneralSettingsFormData } from "@/schemas/settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, MessageSquare, Bot, Loader2 } from "lucide-react";
import {
  HorarioFuncionamento,
  LimitesMensagens,
  ComportamentoAmelia,
} from "@/types/settings";

const DIAS_SEMANA = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export function GeneralTab() {
  const { settings, updateSetting, isLoading } = useSystemSettings("amelia");

  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      horario_inicio: "08:00",
      horario_fim: "18:00",
      dias: ["seg", "ter", "qua", "qui", "sex"],
      max_por_dia: 10,
      intervalo_minutos: 30,
      tom: "profissional",
      auto_escalar_apos: 5,
      qualificacao_automatica: true,
    },
  });

  useEffect(() => {
    if (settings) {
      const horarioSetting = settings.find((s) => s.key === "horario_funcionamento");
      const horario = horarioSetting?.value as unknown as HorarioFuncionamento | undefined;
      const limitesSetting = settings.find((s) => s.key === "limites_mensagens");
      const limites = limitesSetting?.value as unknown as LimitesMensagens | undefined;
      const comportamentoSetting = settings.find((s) => s.key === "comportamento");
      const comportamento = comportamentoSetting?.value as unknown as ComportamentoAmelia | undefined;

      form.reset({
        horario_inicio: horario?.inicio || "08:00",
        horario_fim: horario?.fim || "18:00",
        dias: horario?.dias || ["seg", "ter", "qua", "qui", "sex"],
        max_por_dia: limites?.max_por_dia || 10,
        intervalo_minutos: limites?.intervalo_minutos || 30,
        tom: comportamento?.tom || "profissional",
        auto_escalar_apos: comportamento?.auto_escalar_apos || 5,
        qualificacao_automatica: comportamento?.qualificacao_automatica ?? true,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: GeneralSettingsFormData) => {
    await Promise.all([
      updateSetting.mutateAsync({
        category: "amelia",
        key: "horario_funcionamento",
        value: {
          inicio: data.horario_inicio,
          fim: data.horario_fim,
          dias: data.dias,
        },
      }),
      updateSetting.mutateAsync({
        category: "amelia",
        key: "limites_mensagens",
        value: {
          max_por_dia: data.max_por_dia,
          intervalo_minutos: data.intervalo_minutos,
        },
      }),
      updateSetting.mutateAsync({
        category: "amelia",
        key: "comportamento",
        value: {
          tom: data.tom,
          auto_escalar_apos: data.auto_escalar_apos,
          qualificacao_automatica: data.qualificacao_automatica,
        },
      }),
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Horário de Funcionamento */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Horário de Funcionamento</CardTitle>
            </div>
            <CardDescription>
              Define quando a Amélia pode enviar mensagens ativamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="horario_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de Início</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="horario_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de Fim</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dias da Semana</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <div key={dia.id} className="flex items-center gap-1.5">
                        <Checkbox
                          id={dia.id}
                          checked={field.value?.includes(dia.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, dia.id]);
                            } else {
                              field.onChange(
                                field.value?.filter((d) => d !== dia.id)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={dia.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {dia.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Limites de Mensagens */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Limites de Mensagens</CardTitle>
            </div>
            <CardDescription>
              Controle a frequência de envio para cada lead
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="max_por_dia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo por Dia</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Mensagens por lead por dia
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="intervalo_minutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intervalo Mínimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10))
                        }
                      />
                    </FormControl>
                    <FormDescription>Minutos entre mensagens</FormDescription>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Comportamento da Amélia */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Comportamento da Amélia</CardTitle>
            </div>
            <CardDescription>
              Personalize como a Amélia interage com leads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tom de Comunicação</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="profissional">Profissional</SelectItem>
                      <SelectItem value="informal">Informal</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto_escalar_apos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalar para Humano Após</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Número de mensagens sem resolução antes de escalar
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qualificacao_automatica"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Qualificação Automática
                    </FormLabel>
                    <FormDescription>
                      Permite que a Amélia qualifique leads automaticamente
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateSetting.isPending}>
            {updateSetting.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </form>
    </Form>
  );
}
