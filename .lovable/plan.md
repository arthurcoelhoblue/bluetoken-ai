

## Plano: Atendimento Automatico via Amelia para Leads SGT (com Horario Comercial)

### Situacao Atual

O fluxo atual do SGT ao receber um lead:
1. Autentica e armazena o evento
2. Enriquece os dados do lead (lead_contacts, contacts, pessoas)
3. Classifica (ICP, temperatura, prioridade)
4. Inicia uma cadencia de templates (mensagens estaticas)

**Problemas:**
- Nao verifica se o lead ja esta sendo atendido manualmente por um vendedor
- Nao cria o estado conversacional para a Amelia
- O cadence-runner nao verifica modo de atendimento antes de disparar
- Nao respeita horario comercial

### Logica Proposta

```text
Lead chega do SGT
       |
       v
  Enriquecer dados (sempre)
       |
       v
  Verificar lead_conversation_state.modo
       |
  +----+----+
  |         |
MANUAL    SDR_IA / inexistente
  |         |
  v         v
APENAS   Criar conversation_state (se nao existe)
ENRIQUECER  + Classificar
  |         + Decidir cadencia
  v         |
 FIM        v
        Horario comercial? (09h-18h seg-sex, Brasilia)
            |
       +----+----+
       |         |
      SIM       NAO
       |         |
       v         v
   Iniciar    Agendar cadencia
   cadencia   com next_run_at = proximo
   agora      horario comercial (ex: seg 09h)
       |         |
       v         v
      FIM       FIM
```

### Horario Comercial

- Segunda a sexta, 09h as 18h, horario de Brasilia (America/Sao_Paulo)
- Fora desse horario: a cadencia e criada mas com `next_run_at` agendado para o proximo horario comercial valido
- A funcao helper sera reutilizavel tanto no sgt-webhook quanto no cadence-runner

### Mudancas Necessarias

**1. `supabase/functions/sgt-webhook/index.ts`**

- Adicionar funcao helper `isHorarioComercial()` que verifica se o momento atual esta dentro de seg-sex 09h-18h (America/Sao_Paulo)
- Adicionar funcao helper `proximoHorarioComercial()` que retorna o proximo momento valido (ex: se for sabado 15h, retorna segunda 09h)
- Apos o enriquecimento e antes da classificacao:
  - Consultar `lead_conversation_state` para o lead + empresa
  - Se `modo = 'MANUAL'`: pular classificacao e cadencia, apenas enriquecer
  - Se nao existe estado: criar com `modo: 'SDR_IA'`, `estado_funil: 'SAUDACAO'`
- Na funcao `iniciarCadenciaParaLead`: se fora de horario comercial, definir `next_run_at` para o proximo horario comercial ao inves de `now()`

**2. `supabase/functions/cadence-runner/index.ts`**

- Adicionar as mesmas funcoes helper de horario comercial
- No `processarRun`, antes de disparar a mensagem:
  - Verificar se esta em horario comercial; se nao, reagendar `next_run_at` para proximo horario valido e pular
  - Verificar `lead_conversation_state.modo`; se `MANUAL`, pausar a cadencia

### Secao Tecnica

**Helper de horario comercial (usado em ambas as functions):**

```text
function isHorarioComercial(): boolean {
  // Converter para America/Sao_Paulo
  // Verificar: dia da semana (1-5 = seg-sex) E hora (>= 9 E < 18)
}

function proximoHorarioComercial(): Date {
  // Se hoje e dia util e hora < 9: retorna hoje as 09:00
  // Se hoje e dia util e hora >= 18: retorna amanha as 09:00 (ou segunda se sexta)
  // Se fim de semana: retorna proxima segunda as 09:00
}
```

**No sgt-webhook, bloco entre sanitizacao e classificacao:**

```text
// Verificar modo de atendimento
const convState = buscar lead_conversation_state (lead_id, empresa)

if (convState?.modo === 'MANUAL') {
  // Apenas enriquecer, logar e retornar
  return { success: true, enriched_only: true }
}

if (!convState) {
  // Criar estado conversacional para Amelia
  insert lead_conversation_state com modo: 'SDR_IA', estado_funil: 'SAUDACAO'
}
```

**Na funcao iniciarCadenciaParaLead do sgt-webhook:**

```text
// Definir next_run_at com base no horario comercial
const nextRunAt = isHorarioComercial() ? now() : proximoHorarioComercial()

insert lead_cadence_runs com next_run_at = nextRunAt
```

**No cadence-runner processarRun:**

```text
// Antes de enviar mensagem:
// 1. Verificar horario comercial
if (!isHorarioComercial()) {
  update lead_cadence_runs set next_run_at = proximoHorarioComercial()
  return { status: 'REAGENDADO' }
}

// 2. Verificar modo de atendimento
if (convState?.modo === 'MANUAL') {
  update lead_cadence_runs set status = 'PAUSADA'
  return { status: 'PAUSADA', motivo: 'atendimento manual' }
}
```

### Resultado Esperado

- Leads novos fora de horario: dados enriquecidos imediatamente, cadencia agendada para proximo dia util as 09h
- Leads novos em horario: Amelia inicia atendimento automaticamente
- Leads em modo manual: apenas enriquecimento, sem interferencia no vendedor
- Cadence-runner: dupla protecao - nao dispara fora de horario e nao dispara para leads em atendimento manual
