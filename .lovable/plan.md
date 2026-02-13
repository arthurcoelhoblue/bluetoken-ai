
## Auditoria Completa: Pontas Soltas, Mocks e Features Desligadas

Apos varredura completa no codigo e banco de dados, identifiquei os seguintes problemas organizados por criticidade.

---

### CRITICO - Precisa resolver agora

**1. SMS mockado no cadence-runner**
- Arquivo: `supabase/functions/cadence-runner/index.ts` (linha 401-403)
- O canal SMS retorna `{ success: true }` sem fazer nada -- apenas imprime `[MOCK] SMS enviado`
- Se alguma cadencia tiver step do tipo SMS, o sistema finge que enviou
- **Solucao**: Remover suporte a SMS por completo (nao e usado) ou implementar via API real. Recomendo remover e logar warning se algum step tentar usar SMS, marcando como ERRO

**2. ESCALAR_HUMANO e CRIAR_TAREFA_CLOSER nao notificam ninguem**
- Arquivo: `supabase/functions/sdr-ia-interpret/index.ts` (linhas 3840-3887)
- Quando a IA decide escalar ou criar tarefa closer, apenas insere um evento na tabela `lead_cadence_events` e loga no console
- **Nao chama** a edge function `notify-closer` que ja existe e esta pronta
- **Nao muda** o `lead_conversation_state.modo` para MANUAL (o vendedor nao sabe que precisa assumir)
- **Resultado**: Lead fica em limbo -- IA decide escalar mas ninguem e notificado
- **Solucao**: Na acao ESCALAR_HUMANO e CRIAR_TAREFA_CLOSER, chamar `notify-closer` e atualizar `lead_conversation_state.modo` para MANUAL

**3. notify-closer usa emails placeholder**
- Arquivo: `supabase/functions/notify-closer/index.ts` (linha 119-120)
- Emails hardcoded: `closer@tokeniza.com.br` e `closer@grupoblue.com.br`
- Esses emails provavelmente nao existem ou nao sao monitorados
- **Solucao**: Buscar do `system_settings` ou de uma tabela de responsaveis por empresa

---

### IMPORTANTE - Feature desligada ou incompleta

**4. Horario da Amelia inconsistente entre banco e codigo**
- No banco (`system_settings`): `amelia.horario_funcionamento = 08:00-18:00`
- No codigo recente (`sgt-webhook` e `cadence-runner`): hardcoded `09:00-18:00`
- O `sdr-ia-interpret` **nao consulta** a configuracao de horario do banco
- **Solucao**: Alinhar tudo para usar a configuracao do banco (09:00-18:00 conforme aprovado), atualizar o registro no banco, e fazer o sdr-ia-interpret tambem respeitar horario

**5. Integracao Pipedrive desligada mas com infraestrutura pronta**
- `system_settings`: `integrations.pipedrive.enabled = false`
- Edge function `pipedrive-sync` existe e funciona
- Secret `PIPEDRIVE_API_TOKEN` configurada
- Leads ja chegam com `pipedrive_deal_id` e `url_pipedrive`
- **Solucao**: Nenhuma acao tecnica necessaria -- esta desligado propositalmente. Apenas confirmar se deve permanecer assim

**6. connectionName "Arthur" hardcoded no whatsapp-send**
- Arquivo: `supabase/functions/whatsapp-send/index.ts` (linha 179)
- O nome da conexao WhatsApp "Arthur" esta fixo no codigo (canal Mensageria)
- **Nota**: Canal Mensageria esta `enabled: false` para ambas empresas (BLUE e TOKENIZA usam BlueChat agora)
- **Solucao**: Como Mensageria esta desativada, nao e urgente. Mas se reativar, o connectionName deveria vir de configuracao

**7. Email em producao mas `email.enabled = false`**
- `system_settings`: `integrations.email.enabled = false`
- `email.modo_teste.ativo = false` (modo teste DESLIGADO -- emails reais seriam enviados)
- SMTP configurado (secrets existem)
- **Risco**: Se alguma cadencia tiver step de email, vai tentar enviar de verdade (modo teste desligado) mas a integracao esta marcada como desabilitada
- **Solucao**: Garantir que o cadence-runner verifique `integrations.email.enabled` antes de enviar emails, ou ligar a integracao se pronta

---

### MENOR - Limpeza e alinhamento

**8. DEFAULT_TEST_PHONE hardcoded**
- `supabase/functions/whatsapp-send/index.ts` (linha 18): `5581987580922`
- Esse numero so e usado como fallback se `system_settings` nao tiver `numero_teste`
- Hoje o banco tem `numero_teste: 5561998317422` e `modo_teste.ativo = false`
- **Solucao**: Remover o fallback hardcoded e falhar explicitamente se modo teste ativo sem numero configurado

**9. closer_notifications sem registros**
- Tabela existe mas tem 0 registros -- confirma que notify-closer nunca e chamado pelo fluxo real

---

### Secao Tecnica - Mudancas Propostas

**Arquivo `supabase/functions/sdr-ia-interpret/index.ts`**

Na funcao `applyAction`, nos cases ESCALAR_HUMANO e CRIAR_TAREFA_CLOSER:

```text
case 'ESCALAR_HUMANO':
case 'CRIAR_TAREFA_CLOSER':
  // 1. Manter logica existente de eventos
  // 2. ADICIONAR: Chamar notify-closer
  await fetch(`${SUPABASE_URL}/functions/v1/notify-closer`, {
    method: 'POST',
    headers: { Authorization: Bearer ${SERVICE_KEY}, Content-Type: application/json },
    body: JSON.stringify({ lead_id: leadId, empresa, motivo: detalhes?.motivo || acao })
  });
  // 3. ADICIONAR: Mudar modo para MANUAL
  await supabase.from('lead_conversation_state')
    .update({ modo: 'MANUAL', assumido_em: now })
    .eq('lead_id', leadId)
    .eq('empresa', empresa);
```

**Arquivo `supabase/functions/cadence-runner/index.ts`**

No bloco de SMS (linha 401):

```text
// Substituir mock por erro explicito
console.warn('[Disparo] Canal SMS nao implementado');
return { success: false, error: 'Canal SMS nao suportado' };
```

**Arquivo `supabase/functions/notify-closer/index.ts`**

Substituir emails hardcoded por busca no banco:

```text
// Buscar email do closer responsavel da system_settings ou profiles
const { data: closerConfig } = await supabase
  .from('system_settings')
  .select('value')
  .eq('category', empresa.toLowerCase())
  .eq('key', 'closer_email')
  .maybeSingle();

const closerEmail = body.closer_email || closerConfig?.value?.email || fallback;
```

**Banco de dados**

Atualizar horario da Amelia:

```text
UPDATE system_settings 
SET value = '{"inicio": "09:00", "fim": "18:00", "dias": ["seg","ter","qua","qui","sex"]}'
WHERE category = 'amelia' AND key = 'horario_funcionamento';
```

---

### Resumo de Acoes

| # | Item | Acao | Prioridade |
|---|------|------|------------|
| 1 | SMS mockado | Substituir mock por erro explicito | Critico |
| 2 | ESCALAR/CLOSER nao notifica | Chamar notify-closer + mudar modo MANUAL | Critico |
| 3 | Emails closer placeholder | Tornar configuravel via system_settings | Critico |
| 4 | Horario inconsistente | Alinhar banco (09-18) e fazer sdr-ia ler config | Importante |
| 5 | Pipedrive desligado | Manter (decisao de negocio) | Nenhuma |
| 6 | connectionName Arthur | Manter (Mensageria desativada) | Baixa |
| 7 | Email enabled vs modo_teste | Verificar flag enabled no cadence-runner | Importante |
| 8 | DEFAULT_TEST_PHONE | Limpar fallback hardcoded | Menor |
| 9 | closer_notifications vazia | Resolvido ao implementar item 2 | -- |
