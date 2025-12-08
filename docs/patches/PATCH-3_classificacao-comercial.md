# PATCH 3 - Pipeline de Classificação Comercial

## Metadados

- **Data**: 2024-12-08
- **Épico**: Classificação ICP + Persona + Temperatura
- **Status**: ✅ Implementado

## Objetivo

Classificar automaticamente leads recebidos do SGT em:
- **ICP** (Ideal Customer Profile)
- **Persona** (tipo de abordagem)
- **Temperatura** (FRIO/MORNO/QUENTE)
- **Prioridade** (1, 2, 3)

## Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/..._lead_classifications.sql` | Migration | Tabela e enums de classificação |
| `src/types/classification.ts` | TS Types | Enums ICP/Persona/Temperatura/Prioridade |
| `supabase/functions/sgt-webhook/index.ts` | Edge | Lógica completa de classificação |
| `docs/patches/PATCH-3_classificacao-comercial.md` | Doc | Este documento |

## Modelagem de Dados

### Tabela: lead_classifications

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| lead_id | text | ID do lead (do SGT) |
| empresa | empresa_tipo | TOKENIZA ou BLUE |
| icp | icp_tipo | Perfil ideal classificado |
| persona | persona_tipo | Persona para abordagem |
| temperatura | temperatura_tipo | FRIO, MORNO ou QUENTE |
| prioridade | int | 1, 2 ou 3 |
| score_interno | int | Score consolidado 0-100 |
| fonte_evento_id | uuid | FK para sgt_events |
| fonte_evento_tipo | sgt_evento_tipo | Tipo do evento que gerou |
| classificado_em | timestamp | Data da classificação |
| updated_at | timestamp | Última atualização |

### Enums Criados

- **temperatura_tipo**: FRIO, MORNO, QUENTE
- **icp_tipo**: 9 valores (5 Tokeniza + 4 Blue)
- **persona_tipo**: 6 valores (3 Tokeniza + 3 Blue)

## Regras de Classificação

### Tokeniza

| ICP | Condições | Persona | Prioridade |
|-----|-----------|---------|------------|
| TOKENIZA_SERIAL | valor >= 100k OU qtd_inv >= 40 OU qtd_proj >= 20 | CONSTRUTOR_PATRIMONIO | 1 |
| TOKENIZA_ALTO_VOLUME_DIGITAL | tipo_compra = token/nft E valor >= 10k | COLECIONADOR_DIGITAL | 1 |
| TOKENIZA_MEDIO_PRAZO | 20k <= valor < 100k OU 15 <= qtd_inv < 40 | CONSTRUTOR_PATRIMONIO | 2 |
| TOKENIZA_EMERGENTE | 5k <= valor < 20k OU 5 <= qtd_inv < 15 | INICIANTE_CAUTELOSO | 3 |
| TOKENIZA_NAO_CLASSIFICADO | default | null | 3 |

### Blue

| ICP | Condições | Persona | Prioridade |
|-----|-----------|---------|------------|
| BLUE_ALTO_TICKET_IR | ticket >= 4k OU (score >= 30 E stage = Negociação) | CRIPTO_CONTRIBUINTE_URGENTE | 1 |
| BLUE_RECURRENTE | qtd_compras_ir >= 2 | CLIENTE_FIEL_RENOVADOR | 2 |
| BLUE_PERDIDO_RECUPERAVEL | stage = Perdido E score >= 20 | LEAD_PERDIDO_RECUPERAVEL | 3 |
| BLUE_NAO_CLASSIFICADO | default | null | 3 |

### Temperatura

- **QUENTE**: Eventos MQL, CARRINHO_ABANDONADO, CLIQUE_OFERTA ou stage Negociação
- **MORNO**: Eventos LEAD_NOVO, ATUALIZACAO, SCORE_ATUALIZADO com engajamento
- **FRIO**: Sem engajamento recente ou poucos dados

### Score Interno (0-100)

Composição:
- ICP: 0-40 pontos
- Temperatura: 5-30 pontos
- Prioridade: 5-20 pontos
- Bônus dados: 0-10 pontos

## Funcionalidades Implementadas

- ✅ Tabela `lead_classifications` com RLS apropriado
- ✅ Enums de ICP/Persona/Temperatura/Prioridade
- ✅ Função `classificarLead(payload)` na edge function
- ✅ Atualização automática após sgt-webhook
- ✅ Logs de erro em sgt_event_logs quando classificação falhar
- ✅ Upsert por (lead_id, empresa) para evitar duplicatas
- ✅ Cálculo de score interno consolidado

## Políticas RLS

- Admins podem visualizar todas as classificações
- Marketing pode visualizar classificações
- SDR_IA pode visualizar e gerenciar classificações
- Service role pode inserir e atualizar

## Q&A de Testes

| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1 | Lead Tokeniza Serial (valor=150k) | ICP=TOKENIZA_SERIAL, Prio=1 |
| 2 | Lead Tokeniza Emergente (valor=7k) | ICP=TOKENIZA_EMERGENTE, Prio=3 |
| 3 | Lead Blue Alto Ticket (ticket=4.5k) | ICP=BLUE_ALTO_TICKET_IR, Temp=QUENTE |
| 4 | Lead Blue Recorrente (qtd_compras=3) | ICP=BLUE_RECURRENTE, Prio=2 |
| 5 | Lead Blue Perdido (stage=Perdido, score=25) | ICP=BLUE_PERDIDO_RECUPERAVEL |
| 6 | Payload mínimo | ICP=*_NAO_CLASSIFICADO, Prio=3 |
| 7 | Atualização de classificação | Upsert atualiza registro existente |

## Exemplo de Teste

```bash
curl -X POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/sgt-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-003",
    "evento": "MQL",
    "empresa": "TOKENIZA",
    "timestamp": "2024-12-08T12:00:00Z",
    "dados_lead": {
      "nome": "Investidor Serial",
      "email": "serial@test.com"
    },
    "dados_tokeniza": {
      "valor_investido": 150000,
      "qtd_investimentos": 45
    }
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "event_id": "...",
  "classification": {
    "icp": "TOKENIZA_SERIAL",
    "persona": "CONSTRUTOR_PATRIMONIO",
    "temperatura": "QUENTE",
    "prioridade": 1,
    "score_interno": 90
  }
}
```

## Próximos Passos

- PATCH 4: Motor de Cadências (usar classificação para definir fluxo)
- PATCH 5: Dashboard de visualização
- PATCH 6: Decisões de handoff
