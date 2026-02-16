import { useState, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageShell } from '@/components/layout/PageShell';
import { Upload, FileJson, ArrowRight, ArrowLeft, Check, AlertTriangle, Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useImportJobs, useRunImport } from '@/hooks/useImportacao';
import { usePipelines } from '@/hooks/usePipelines';
import type { PipedriveDealRow, PipedrivePersonRow, PipedriveOrgRow, ImportConfig } from '@/types/importacao';
import { toast } from 'sonner';
import { format } from 'date-fns';

type WizardStep = 'upload' | 'mapping' | 'running' | 'done';

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'outline' },
  RUNNING: { label: 'Executando', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'secondary' },
  FAILED: { label: 'Falhou', variant: 'destructive' },
  PARTIAL: { label: 'Parcial', variant: 'outline' },
};

export default function ImportacaoPage() {
  return (
    <AppLayout>
      <ImportacaoContent />
    </AppLayout>
  );
}

function ImportacaoContent() {
  const [step, setStep] = useState<WizardStep>('upload');
  const [dealsFile, setDealsFile] = useState<PipedriveDealRow[]>([]);
  const [personsFile, setPersonsFile] = useState<PipedrivePersonRow[]>([]);
  const [orgsFile, setOrgsFile] = useState<PipedriveOrgRow[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [pipelineMapping, setPipelineMapping] = useState<Record<string, string>>({});
  const [stageMapping, setStageMapping] = useState<Record<string, string>>({});
  const [ownerMapping, setOwnerMapping] = useState<Record<string, string>>({});

  const { data: jobs } = useImportJobs();
  const { mutateAsync: runImport, progress, isPending } = useRunImport();
  const { data: pipelines } = usePipelines();

  // Fetch CRM users for owner mapping
  const [crmUsers, setCrmUsers] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('profiles').select('id, nome').eq('is_active', true).order('nome').then(({ data }) => {
        setCrmUsers((data ?? []).map(u => ({ id: u.id, nome: u.nome || u.id })));
      });
    });
  }, []);

  const uniquePipelines = [...new Set(dealsFile.map(d => String(d.pipeline_id)).filter(Boolean))];
  const uniqueStages = [...new Set(dealsFile.map(d => String(d.stage_id)).filter(Boolean))];
  const uniqueOwners = [...new Set(dealsFile.map(d => String(d.user_id)).filter(v => v && v !== 'undefined'))];

  interface StageWithPipeline { id: string; nome: string; pipeline_name: string; posicao?: number }
  const allStages: StageWithPipeline[] = pipelines?.flatMap(p =>
    (p.pipeline_stages || []).map((s: { id: string; nome: string; posicao?: number }) => ({ ...s, pipeline_name: p.nome }))
  ) || [];

  const handleFileUpload = useCallback(<T,>(setter: (data: T[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const data = Array.isArray(raw) ? raw : raw.data ? raw.data : [raw];
        setter(data);
        toast.success(`${data.length} registros carregados`);
      } catch {
        toast.error('Erro ao ler JSON');
      }
    };
    reader.readAsText(file);
  }, []);

  const canProceedToMapping = dealsFile.length > 0;

  const handleStartImport = async () => {
    setStep('running');
    try {
      const config: ImportConfig = {
        pipeline_mapping: pipelineMapping,
        stage_mapping: stageMapping,
        owner_mapping: ownerMapping,
        skip_existing: skipExisting,
      };
      const result = await runImport({ orgs: orgsFile, persons: personsFile, deals: dealsFile, config });
      setStep('done');
      if (result.status === 'COMPLETED') toast.success(`Importação concluída: ${result.imported} registros`);
      else if (result.status === 'PARTIAL') toast.warning(`Parcial: ${result.imported} ok, ${result.errors} erros`);
      else toast.error(`Falha: ${result.errors} erros`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setStep('mapping');
    }
  };

  const resetWizard = () => {
    setStep('upload');
    setDealsFile([]);
    setPersonsFile([]);
    setOrgsFile([]);
    setPipelineMapping({});
    setStageMapping({});
    setOwnerMapping({});
  };

  return (
    <>
      <PageShell icon={Upload} title="Importação Pipedrive" description="Importe deals, contatos e organizações do Pipedrive para o CRM." />

      <div className="px-6 pb-8">
        <Tabs defaultValue="wizard">
          <TabsList>
            <TabsTrigger value="wizard">Importar</TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wizard" className="mt-4">
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-6">
              {(['upload', 'mapping', 'running', 'done'] as WizardStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <span className={`text-sm ${step === s ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapeamento' : s === 'running' ? 'Executando' : 'Resultado'}
                  </span>
                  {i < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* STEP 1: Upload */}
            {step === 'upload' && (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Deals (deals.json)', count: dealsFile.length, setter: setDealsFile },
                  { label: 'Persons (persons.json)', count: personsFile.length, setter: setPersonsFile },
                  { label: 'Organizations (orgs.json)', count: orgsFile.length, setter: setOrgsFile },
                ].map(({ label, count, setter }) => (
                  <Card key={label}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileJson className="h-4 w-4" /> {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input type="file" accept=".json" onChange={handleFileUpload(setter)} />
                      {count > 0 && <Badge variant="secondary" className="mt-2">{count} registros</Badge>}
                    </CardContent>
                  </Card>
                ))}

                <Card className="md:col-span-3">
                  <CardContent className="pt-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch checked={skipExisting} onCheckedChange={setSkipExisting} id="skip" />
                      <Label htmlFor="skip">Pular registros já existentes</Label>
                    </div>
                    <Button onClick={() => setStep('mapping')} disabled={!canProceedToMapping}>
                      Próximo <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 2: Mapping */}
            {step === 'mapping' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mapeamento de Pipelines</CardTitle>
                    <CardDescription>Associe cada pipeline do Pipedrive a um pipeline do CRM</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {uniquePipelines.map(pid => (
                      <div key={pid} className="flex items-center gap-4">
                        <span className="text-sm font-mono w-32 shrink-0">Pipeline #{pid}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Select value={pipelineMapping[pid] || ''} onValueChange={v => setPipelineMapping(prev => ({ ...prev, [pid]: v }))}>
                          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar pipeline CRM" /></SelectTrigger>
                          <SelectContent>
                            {pipelines?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {uniquePipelines.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pipeline encontrado nos deals.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mapeamento de Stages</CardTitle>
                    <CardDescription>Associe cada stage do Pipedrive a um stage do CRM</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {uniqueStages.map(sid => (
                      <div key={sid} className="flex items-center gap-4">
                        <span className="text-sm font-mono w-32 shrink-0">Stage #{sid}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Select value={stageMapping[sid] || ''} onValueChange={v => setStageMapping(prev => ({ ...prev, [sid]: v }))}>
                          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar stage CRM" /></SelectTrigger>
                          <SelectContent>
                            {allStages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.pipeline_name} → {s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {uniqueStages.length === 0 && <p className="text-sm text-muted-foreground">Nenhum stage encontrado nos deals.</p>}
                  </CardContent>
                </Card>

                {/* Owner mapping */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Mapeamento de Vendedores</CardTitle>
                    <CardDescription>Associe cada user_id do Pipedrive a um vendedor do CRM</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {uniqueOwners.map(uid => (
                      <div key={uid} className="flex items-center gap-4">
                        <span className="text-sm font-mono w-32 shrink-0">User #{uid}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Select value={ownerMapping[uid] || ''} onValueChange={v => setOwnerMapping(prev => ({ ...prev, [uid]: v }))}>
                          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar vendedor CRM" /></SelectTrigger>
                          <SelectContent>
                            {crmUsers.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {uniqueOwners.length === 0 && <p className="text-sm text-muted-foreground">Nenhum user_id encontrado nos deals.</p>}
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                  <Button onClick={handleStartImport} disabled={isPending}>
                    Iniciar Importação <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Running */}
            {step === 'running' && progress && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Importando...
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Fase: <span className="font-semibold capitalize">{progress.phase}</span> — {progress.current}/{progress.total}
                    </p>
                    <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} />
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="text-green-600">✓ Importados: {progress.imported}</span>
                    <span className="text-yellow-600">⊘ Pulados: {progress.skipped}</span>
                    <span className="text-red-600">✗ Erros: {progress.errors}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 4: Done */}
            {step === 'done' && progress && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" /> Importação Concluída
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-green-500/10">
                      <p className="text-2xl font-bold text-green-600">{progress.imported}</p>
                      <p className="text-sm text-muted-foreground">Importados</p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-500/10">
                      <p className="text-2xl font-bold text-yellow-600">{progress.skipped}</p>
                      <p className="text-sm text-muted-foreground">Pulados</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10">
                      <p className="text-2xl font-bold text-red-600">{progress.errors}</p>
                      <p className="text-sm text-muted-foreground">Erros</p>
                    </div>
                  </div>
                  <Button onClick={resetWizard} variant="outline">Nova Importação</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Importações</CardTitle>
              </CardHeader>
              <CardContent>
                {!jobs?.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma importação realizada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Importados</TableHead>
                        <TableHead>Pulados</TableHead>
                        <TableHead>Erros</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map(job => {
                        const badge = STATUS_BADGES[job.status] || STATUS_BADGES.PENDING;
                        return (
                          <TableRow key={job.id}>
                            <TableCell className="text-sm">{format(new Date(job.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                            <TableCell className="text-sm font-mono">{job.tipo}</TableCell>
                            <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                            <TableCell className="text-green-600 font-semibold">{job.imported}</TableCell>
                            <TableCell className="text-yellow-600">{job.skipped}</TableCell>
                            <TableCell className="text-red-600">{job.errors}</TableCell>
                            <TableCell className="text-sm">{job.started_by_nome || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
