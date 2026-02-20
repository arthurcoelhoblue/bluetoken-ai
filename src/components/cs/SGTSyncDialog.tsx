import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Empresa = 'BLUE' | 'TOKENIZA';

interface BatchResult {
  processados: number;
  novos_contatos: number;
  novos_cs_customers: number;
  novos_contratos: number;
  ignorados: number;
  erros: number;
  offset_atual: number;
  proximo_offset: number;
  ciclo_completo: boolean;
  total_sgt: number | null;
  empresa: string;
}

interface EmpresaStats {
  processados: number;
  novos_contatos: number;
  novos_cs_customers: number;
  novos_contratos: number;
  ignorados: number;
  erros: number;
  batches: number;
  concluido: boolean;
}

function emptyStats(): EmpresaStats {
  return {
    processados: 0,
    novos_contatos: 0,
    novos_cs_customers: 0,
    novos_contratos: 0,
    ignorados: 0,
    erros: 0,
    batches: 0,
    concluido: false,
  };
}

export function SGTSyncDialog() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [blueStats, setBlueStats] = useState<EmpresaStats>(emptyStats());
  const [tokenizaStats, setTokenizaStats] = useState<EmpresaStats>(emptyStats());

  const addLog = (msg: string) => setStatusLog(prev => [...prev, `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`]);

  const runImportForEmpresa = async (empresa: Empresa, isFirst: boolean): Promise<EmpresaStats> => {
    const stats = emptyStats();
    let offset = isFirst ? undefined : 0;
    let resetOffset = true;

    addLog(`Iniciando import ${empresa}...`);

    while (true) {
      const body: Record<string, any> = { empresa };
      if (resetOffset) { body.reset_offset = true; resetOffset = false; }
      if (offset !== undefined) body.offset = offset;

      const { data, error } = await supabase.functions.invoke('sgt-full-import', { body });

      if (error || !data) {
        addLog(`❌ ${empresa}: Erro na chamada — ${error?.message || 'resposta vazia'}`);
        break;
      }

      const result = data as BatchResult;

      stats.processados += result.processados;
      stats.novos_contatos += result.novos_contatos;
      stats.novos_cs_customers += result.novos_cs_customers;
      stats.novos_contratos += (result.novos_contratos ?? 0);
      stats.ignorados += result.ignorados;
      stats.erros += result.erros;
      stats.batches++;

      addLog(
        `${empresa} — batch ${stats.batches}: ${result.processados} processados, ` +
        `${result.novos_cs_customers} novos clientes CS, ` +
        `${result.ignorados} ignorados` +
        (empresa === 'TOKENIZA' ? `, ${result.novos_contratos} contratos` : '') +
        (result.erros > 0 ? `, ⚠️ ${result.erros} erros` : '')
      );

      // Update live stats
      if (empresa === 'BLUE') {
        setBlueStats({ ...stats });
      } else {
        setTokenizaStats({ ...stats });
      }

      if (result.ciclo_completo) {
        addLog(`✅ ${empresa}: ciclo completo! ${stats.novos_cs_customers} novos clientes importados.`);
        stats.concluido = true;
        break;
      }

      offset = result.proximo_offset;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return stats;
  };

  const handleSync = async () => {
    setRunning(true);
    setStatusLog([]);
    setBlueStats(emptyStats());
    setTokenizaStats(emptyStats());

    try {
      setCurrentEmpresa('BLUE');
      const blue = await runImportForEmpresa('BLUE', true);
      setBlueStats({ ...blue, concluido: true });

      setCurrentEmpresa('TOKENIZA');
      const tokeniza = await runImportForEmpresa('TOKENIZA', true);
      setTokenizaStats({ ...tokeniza, concluido: true });

      setCurrentEmpresa(null);
      const totalNovos = blue.novos_cs_customers + tokeniza.novos_cs_customers;
      toast.success(`Sincronização concluída! ${totalNovos} novos clientes importados.`);
      addLog(`🎉 Sincronização completa. Total de novos clientes: ${totalNovos}`);
    } catch (err) {
      addLog(`❌ Erro inesperado: ${String(err)}`);
      toast.error('Erro durante a sincronização');
    } finally {
      setRunning(false);
    }
  };

  const totalNovos = blueStats.novos_cs_customers + tokenizaStats.novos_cs_customers;
  const ambosCompletos = blueStats.concluido && tokenizaStats.concluido;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronizar com SGT
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sincronização Completa com SGT</DialogTitle>
          <DialogDescription>
            Importa todos os clientes do SGT (755 Blue + 1049 Tokeniza) diretamente para o CRM.
            Clientes sem plano (Blue) ou sem investimento realizado (Tokeniza) são ignorados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Blue */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Blue</span>
                {blueStats.concluido ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : currentEmpresa === 'BLUE' && running ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Processados</span>
                <span className="font-medium">{blueStats.processados}</span>
                <span className="text-muted-foreground">Novos clientes CS</span>
                <span className="font-medium text-primary">{blueStats.novos_cs_customers}</span>
                <span className="text-muted-foreground">Novos contatos</span>
                <span className="font-medium">{blueStats.novos_contatos}</span>
                <span className="text-muted-foreground">Ignorados</span>
                <span className="font-medium text-muted-foreground">{blueStats.ignorados}</span>
                {blueStats.erros > 0 && (
                  <>
                    <span className="text-muted-foreground">Erros</span>
                    <span className="font-medium text-destructive">{blueStats.erros}</span>
                  </>
                )}
              </div>
              {currentEmpresa === 'BLUE' && running && (
                <Progress value={undefined} className="h-1" />
              )}
            </div>

            {/* Tokeniza */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Tokeniza</span>
                {tokenizaStats.concluido ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : currentEmpresa === 'TOKENIZA' && running ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Processados</span>
                <span className="font-medium">{tokenizaStats.processados}</span>
                <span className="text-muted-foreground">Novos clientes CS</span>
                <span className="font-medium text-primary">{tokenizaStats.novos_cs_customers}</span>
                <span className="text-muted-foreground">Novos contatos</span>
                <span className="font-medium">{tokenizaStats.novos_contatos}</span>
                <span className="text-muted-foreground">Contratos/aportes</span>
                <span className="font-medium">{tokenizaStats.novos_contratos}</span>
                <span className="text-muted-foreground">Ignorados</span>
                <span className="font-medium text-muted-foreground">{tokenizaStats.ignorados}</span>
                {tokenizaStats.erros > 0 && (
                  <>
                    <span className="text-muted-foreground">Erros</span>
                    <span className="font-medium text-destructive">{tokenizaStats.erros}</span>
                  </>
                )}
              </div>
              {currentEmpresa === 'TOKENIZA' && running && (
                <Progress value={undefined} className="h-1" />
              )}
            </div>
          </div>

          {/* Result summary */}
          {ambosCompletos && (
            <div className="flex items-center gap-2 p-3 bg-accent rounded-lg border">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  Sincronização concluída!
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalNovos} novos clientes importados para o CRM.
                  {tokenizaStats.novos_contratos > 0 && ` ${tokenizaStats.novos_contratos} investimentos Tokeniza registrados.`}
                </p>
              </div>
            </div>
          )}

          {/* Log */}
          {statusLog.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Log de execução</p>
              <div className="bg-muted/30 rounded-lg p-3 max-h-40 overflow-auto font-mono text-xs space-y-0.5">
                {statusLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes('❌') ? 'text-destructive' :
                      line.includes('✅') || line.includes('🎉') ? 'text-primary' :
                      line.includes('⚠️') ? 'text-warning' :
                      'text-muted-foreground'
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {running && currentEmpresa && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Importando {currentEmpresa}...</span>
              </>
            )}
            {ambosCompletos && (
              <Badge variant="outline" className="text-primary border-primary/40">
                Completo
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              {ambosCompletos ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button onClick={handleSync} disabled={running} className="gap-2">
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando...</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> {ambosCompletos ? 'Sincronizar Novamente' : 'Iniciar Sincronização'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
