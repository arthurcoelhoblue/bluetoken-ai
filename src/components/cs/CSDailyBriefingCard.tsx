import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export function CSDailyBriefingCard() {
  const { activeCompany } = useCompany();
  const empresa = activeCompany;
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cs-daily-briefing', {
        body: { empresa },
      });
      if (error) throw error;
      setBriefing(data?.briefing || data?.message || 'Briefing gerado sem conteúdo.');
    } catch {
      toast.error('Erro ao gerar briefing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-chart-4" />
          Briefing Diário — Amélia
          <Badge variant="secondary" className="text-xs">IA</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchBriefing} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {briefing ? 'Atualizar' : 'Gerar Briefing'}
        </Button>
      </CardHeader>
      <CardContent>
        {briefing ? (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{briefing}</div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em "Gerar Briefing" para a Amélia analisar a carteira de clientes e gerar um resumo executivo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
