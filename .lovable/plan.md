

# Fase 1.1 - Migrar Validacao Manual para Zod no sgt-webhook

## Contexto

O relatorio de validacao da Manus AI identificou que o `sgt-webhook` usa validacao manual (`validatePayload`) em vez de Zod schemas. Os outros dois webhooks (`bluechat-inbound` e `whatsapp-inbound`) ja usam Zod corretamente.

## Escopo

Apenas 1 arquivo precisa ser alterado: `supabase/functions/sgt-webhook/index.ts`

## O que muda

### Substituir `validatePayload` (linhas 808-841) por schema Zod

O schema Zod cobrira:

```text
sgtPayloadSchema = z.object({
  lead_id:    z.string().min(1),
  evento:     z.enum(['LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO']),
  empresa:    z.enum(['TOKENIZA', 'BLUE']),
  timestamp:  z.string().min(1),
  dados_lead: z.object({
    nome:     z.string().max(200).optional(),
    email:    z.string().email().max(255),
    telefone: z.string().max(20).optional(),
    utm_source / utm_medium / utm_campaign / utm_term / utm_content: z.string().optional(),
    score:    z.number().optional(),
    stage:    z.string().optional(),
    ...demais campos opcionais
  }),
  dados_empresa:       z.record(z.unknown()).optional(),
  prioridade_marketing: z.enum(['URGENTE','QUENTE','MORNO','FRIO']).optional(),
  metadata:            z.record(z.unknown()).optional(),
})
```

### Preservar `normalizePayloadFormat`

A funcao `normalizePayloadFormat` (que converte formato flat para nested) continua existindo e sera executada ANTES do parse Zod. Isso garante retrocompatibilidade com integradores que enviam campos no nivel raiz.

### Fluxo atualizado

```text
1. JSON.parse(body)
2. normalizePayloadFormat(raw)   -- flat -> nested
3. sgtPayloadSchema.safeParse()  -- Zod validation
4. Se !success -> 400 com errors formatados
5. Continua processamento com dados tipados
```

### Adicionar import do Zod

```text
import { z } from "https://esm.sh/zod@3.25.76";
```

(Mesmo import ja usado em bluechat-inbound e whatsapp-inbound)

## O que NAO muda

- Nenhuma logica de negocio (classificacao, dedup, cadencia, CRM)
- Nenhum outro arquivo
- Nenhuma tabela ou migracao
- `normalizePayloadFormat` continua funcionando igual
- Comportamento identico para payloads validos

## Risco

| Risco | Mitigacao |
|-------|----------|
| Schema Zod rejeitar payload que a validacao manual aceitava | Schema sera permissivo nos campos opcionais; campos extras permitidos via passthrough |
| Formato de erro diferente quebrar integradores | Manter mesmo status 400 e estrutura { error: string } |

## Resultado

- Item 1.1 passa de "Parcialmente Validado" para "Validado" na proxima auditoria
- Consistencia: todos os 3 webhooks publicos usam Zod
- Mensagens de erro mais ricas e precisas automaticamente

