

# Correção do Loop Infinito no Cadence Runner + Escalação Anti-Limbo

## Problema Atual

Quando o disparo de uma mensagem falha (ex: "Nenhuma conversa Blue Chat ativa"), o cadence-runner reagenda o mesmo step em 15-30 minutos **sem limite de tentativas**. Isso gera:
- Mensagens repetidas infinitamente
- Lead preso num ciclo de erros sem ninguem ser avisado

## Solucao

Dois mecanismos complementares:

### 1. Contador de Retries no Cadence Runner

Usar o campo `detalhes` (JSONB) dos eventos de erro para contar quantas vezes o mesmo step falhou. Sem precisar alterar o schema do banco.

**Logica:**
- Antes de reagendar, contar quantos eventos `ERRO` existem para aquele `run_id + step_ordem`
- Se `erro_count >= 3`: parar de tentar e escalar (proximo item)
- Se `erro_count < 3`: reagendar normalmente (como hoje)

### 2. Escalacao Automatica quando atinge o limite

Quando o limite de 3 tentativas e atingido:

1. **Marcar o run como `PAUSADA`** (nao `CANCELADA`, para poder ser retomada manualmente)
2. **Criar notificacao** para o owner do lead (ou gestor) na tabela `notifications`:
   - Titulo: "Cadencia pausada por erro recorrente"
   - Mensagem: "O step X da cadencia Y falhou 3 vezes para o lead Z. Motivo: [erro]. Verifique e retome manualmente."
   - Link: para o detalhe da conversa
3. **Registrar evento** `ERRO` final com `detalhes.motivo = 'max_retries_exceeded'`

### 3. Fluxo de Recuperacao (anti-limbo)

O lead NAO fica no limbo porque:

- O vendedor/gestor recebe uma **notificacao visivel** no sistema
- O run fica em status `PAUSADA` (aparece no dashboard de cadencias como "requer acao")
- O vendedor pode:
  - Corrigir o problema (ex: adicionar telefone, reabrir ticket Blue Chat)
  - Retomar a cadencia manualmente pelo card de cadencia no deal
  - Ou cancelar e tratar o lead de outra forma

```text
Erro no disparo
     |
     v
erro_count < 3? ──SIM──> Reagenda em 15-30min (como hoje)
     |
    NAO
     |
     v
Pausa o run (PAUSADA)
     |
     v
Cria notificacao pro owner/gestor
     |
     v
Vendedor ve no sino / dashboard
     |
     v
Corrige + retoma OU cancela + trata manualmente
```

## Mudancas Tecnicas

### Arquivo: `supabase/functions/cadence-runner/index.ts`

Nos 3 blocos de erro (linhas ~558-584, ~595-621, ~636-662):

1. Antes de reagendar, contar erros anteriores:
```typescript
const { count: erroCount } = await supabase
  .from('lead_cadence_events')
  .select('*', { count: 'exact', head: true })
  .eq('lead_cadence_run_id', run.id)
  .eq('step_ordem', currentStep.ordem)
  .eq('tipo_evento', 'ERRO');
```

2. Se `erroCount >= 3`:
   - Atualizar run para `PAUSADA` em vez de reagendar
   - Inserir notificacao na tabela `notifications`
   - Logar evento final

3. Se `erroCount < 3`:
   - Manter comportamento atual (reagenda em 15-30min)

### Funcao auxiliar a ser criada no mesmo arquivo:

```typescript
async function escalarErroPermanente(supabase, run, currentStep, erro) {
  // 1. Pausar run
  await supabase.from('lead_cadence_runs')
    .update({ status: 'PAUSADA', updated_at: new Date().toISOString() })
    .eq('id', run.id);

  // 2. Evento final
  await supabase.from('lead_cadence_events').insert({
    lead_cadence_run_id: run.id,
    step_ordem: currentStep.ordem,
    template_codigo: currentStep.template_codigo,
    tipo_evento: 'ERRO',
    detalhes: { error: erro, motivo: 'max_retries_exceeded', tentativas: 3 },
  });

  // 3. Buscar owner do lead
  const { data: contact } = await supabase
    .from('lead_contacts')
    .select('owner_id, nome')
    .eq('lead_id', run.lead_id)
    .eq('empresa', run.empresa)
    .maybeSingle();

  const ownerId = contact?.owner_id;
  if (ownerId) {
    await supabase.from('notifications').insert({
      user_id: ownerId,
      empresa: run.empresa,
      titulo: 'Cadencia pausada por erro recorrente',
      mensagem: `Step ${currentStep.ordem} falhou 3x para ${contact?.nome || 'lead'}. Erro: ${erro}`,
      tipo: 'ALERTA',
      referencia_tipo: 'LEAD',
      referencia_id: run.lead_id,
      link: '/conversas',
    });
  }
}
```

## Sem alteracoes de banco

- O campo `detalhes` (JSONB) nos eventos ja suporta metadados extras
- A tabela `notifications` ja existe e e usada pelo sistema
- O status `PAUSADA` ja existe no enum `cadence_run_status`
- Nenhuma migration necessaria

## Resumo

| Cenario | Antes | Depois |
|---------|-------|--------|
| Disparo falha 1x | Reagenda em 15min | Reagenda em 15min (igual) |
| Disparo falha 3x | Reagenda eternamente | Pausa + notifica vendedor |
| Lead sem Blue Chat | Loop infinito | Pausa apos 3 tentativas |
| Vendedor descobre? | Nunca (so olhando logs) | Notificacao automatica |
| Lead recuperavel? | Nao (preso no loop) | Sim (retomar apos corrigir) |
