import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Target,
  Thermometer,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Mail,
  MessageSquare,
  Wallet,
  Award,
  Info,
} from 'lucide-react';
import type { ClassificationJustificativa, ScoreBreakdown } from '@/types/classification';

interface ClassificationExplanationProps {
  justificativa: ClassificationJustificativa | null;
}

function ScoreItem({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  if (value === 0) return null;
  
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        +{value}
      </Badge>
    </div>
  );
}

function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreBreakdown }) {
  const items = [
    { label: 'Base (Temperatura)', value: breakdown.base_temperatura, icon: Thermometer, color: 'text-orange-500' },
    { label: 'Bônus ICP', value: breakdown.bonus_icp, icon: Target, color: 'text-blue-500' },
    { label: 'Bônus Evento', value: breakdown.bonus_evento, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Score Externo', value: breakdown.bonus_score_externo, icon: Award, color: 'text-purple-500' },
    { label: 'Engajamento Mautic', value: breakdown.bonus_mautic, icon: Mail, color: 'text-pink-500' },
    { label: 'Conversas Chatwoot', value: breakdown.bonus_chatwoot, icon: MessageSquare, color: 'text-cyan-500' },
    { label: 'Carrinho Abandonado', value: breakdown.bonus_carrinho, icon: ShoppingCart, color: 'text-amber-500' },
    { label: 'Lead Pago', value: breakdown.bonus_lead_pago, icon: Wallet, color: 'text-emerald-500' },
    { label: 'Ajuste Prioridade', value: breakdown.ajuste_prioridade, icon: AlertTriangle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Score Total</span>
        <span className="font-bold text-lg">{breakdown.total}/100</span>
      </div>
      <Progress value={breakdown.total} className="h-2" />
      <Separator className="my-3" />
      <div className="space-y-1">
        {items.map((item) => (
          <ScoreItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

export function ClassificationExplanation({ justificativa }: ClassificationExplanationProps) {
  const [defaultOpen] = useState<string[]>(['razoes']);

  if (!justificativa) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <Info className="h-4 w-4" />
        <span>Explicação não disponível para esta classificação.</span>
      </div>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
      <AccordionItem value="razoes" className="border-none">
        <AccordionTrigger className="py-2 hover:no-underline">
          <span className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Por que esta classificação?
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            {/* ICP Razão */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">ICP</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {justificativa.icp_razao}
              </p>
            </div>

            {/* Temperatura Razão */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Thermometer className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">Temperatura</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {justificativa.temperatura_razao}
              </p>
            </div>

            {/* Prioridade Razão */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium text-sm">Prioridade</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {justificativa.prioridade_razao}
              </p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="score" className="border-none">
        <AccordionTrigger className="py-2 hover:no-underline">
          <span className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Composição do Score
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <ScoreBreakdownCard breakdown={justificativa.score_breakdown} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="dados" className="border-none">
        <AccordionTrigger className="py-2 hover:no-underline">
          <span className="text-sm font-medium flex items-center gap-2">
            <Award className="h-4 w-4" />
            Dados Considerados
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Evento:</span>{' '}
              <span className="font-medium">{justificativa.dados_utilizados.evento}</span>
            </div>
            {justificativa.dados_utilizados.stage && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Stage:</span>{' '}
                <span className="font-medium">{justificativa.dados_utilizados.stage}</span>
              </div>
            )}
            {justificativa.dados_utilizados.valor_investido > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Valor Investido:</span>{' '}
                <span className="font-medium">
                  R$ {justificativa.dados_utilizados.valor_investido.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {justificativa.dados_utilizados.qtd_investimentos > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Investimentos:</span>{' '}
                <span className="font-medium">{justificativa.dados_utilizados.qtd_investimentos}</span>
              </div>
            )}
            {justificativa.dados_utilizados.qtd_compras_ir > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Compras IR:</span>{' '}
                <span className="font-medium">{justificativa.dados_utilizados.qtd_compras_ir}</span>
              </div>
            )}
            {justificativa.dados_utilizados.ticket_medio > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Ticket Médio:</span>{' '}
                <span className="font-medium">
                  R$ {justificativa.dados_utilizados.ticket_medio.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {justificativa.dados_utilizados.mautic_page_hits > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Page Hits:</span>{' '}
                <span className="font-medium">{justificativa.dados_utilizados.mautic_page_hits}</span>
              </div>
            )}
            {justificativa.dados_utilizados.mautic_email_clicks > 0 && (
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Email Clicks:</span>{' '}
                <span className="font-medium">{justificativa.dados_utilizados.mautic_email_clicks}</span>
              </div>
            )}
            {justificativa.dados_utilizados.carrinho_abandonado && (
              <div className="p-2 bg-amber-500/10 rounded col-span-2">
                <ShoppingCart className="h-4 w-4 inline mr-1 text-amber-500" />
                <span className="font-medium">
                  Carrinho abandonado: R$ {justificativa.dados_utilizados.valor_carrinho.toLocaleString('pt-BR')}
                </span>
              </div>
            )}
            {justificativa.dados_utilizados.lead_pago && (
              <div className="p-2 bg-emerald-500/10 rounded col-span-2">
                <Wallet className="h-4 w-4 inline mr-1 text-emerald-500" />
                <span className="font-medium">Lead Pago</span>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
