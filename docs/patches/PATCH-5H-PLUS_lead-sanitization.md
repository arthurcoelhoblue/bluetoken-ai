# PATCH 5H-PLUS — Lead Sanitization & Phone Normalization

## Metadados
- **Data**: 2025-12-10
- **Épico**: 5 – Mensageria & SDR IA
- **Status**: ✅ Implementado
- **Dependências**: PATCH 2, 5A, 5F, 5G

---

## 1. Objetivo

Garantir que apenas leads contatáveis e minimamente qualificados entrem na operação do SDR IA, evitando lixo e ruído, sem descartar leads bons internacionais.

---

## 2. Escopo Implementado

### Inclui
- ✅ Migrations no Supabase (novas colunas + tabela `lead_contact_issues`)
- ✅ Função de sanitização embutida no `sgt-webhook`
- ✅ Melhorias de matching no `whatsapp-inbound` (busca por `telefone_e164`)
- ✅ Hook `useLeadContactIssues` para consulta de issues
- ✅ Componente `ContactIssuesCard` para exibição na UI
- ✅ Integração no `LeadDetail`
- ✅ Sanitização de dados existentes (Fase 0)

### Não Inclui (MVP)
- ❌ `lead_discard_log` (adiado para patch futuro)
- ❌ UI dedicada de "lista de leads descartados"
- ❌ Verificação real de WhatsApp via API

---

## 3. Novas Colunas em `lead_contacts`

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `telefone_e164` | TEXT | NULL | Telefone normalizado (+5561999990001) |
| `ddi` | TEXT | NULL | Código do país (55, 1, 34...) |
| `numero_nacional` | TEXT | NULL | Número sem DDI |
| `origem_telefone` | TEXT | 'SGT' | Origem do dado |
| `contato_internacional` | BOOLEAN | FALSE | Se DDI != 55 |
| `telefone_valido` | BOOLEAN | TRUE | Se passou na normalização |
| `telefone_validado_em` | TIMESTAMPTZ | NULL | Quando foi validado |
| `email_placeholder` | BOOLEAN | FALSE | Se é email placeholder |

---

## 4. Nova Tabela: `lead_contact_issues`

```sql
CREATE TABLE lead_contact_issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           TEXT NOT NULL,
  empresa           empresa_tipo NOT NULL,
  issue_tipo        lead_contact_issue_tipo NOT NULL,
  severidade        TEXT CHECK (severidade IN ('ALTA', 'MEDIA', 'BAIXA')),
  mensagem          TEXT NOT NULL,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  resolvido         BOOLEAN DEFAULT FALSE,
  resolvido_por     UUID REFERENCES profiles(id),
  resolvido_em      TIMESTAMPTZ
);
```

### Tipos de Issue

| Tipo | Severidade | Descrição |
|------|------------|-----------|
| `SEM_CANAL_CONTATO` | ALTA | Sem telefone e sem email |
| `EMAIL_PLACEHOLDER` | MEDIA | Email identificado como placeholder |
| `EMAIL_INVALIDO` | BAIXA | Formato de email inválido |
| `TELEFONE_LIXO` | ALTA | Telefone inválido (000000, etc.) |
| `TELEFONE_SEM_WHATSAPP` | MEDIA | Telefone não tem WhatsApp |
| `DADO_SUSPEITO` | BAIXA | DDI não reconhecido |

---

## 5. Fluxo de Sanitização (sgt-webhook)

```
1. Recebe payload SGT
   ↓
2. Upsert em lead_contacts (dados brutos)
   ↓
3. Executa sanitizeLeadContact()
   - normalizePhoneE164()
   - isPlaceholderEmail()
   - isValidEmailFormat()
   ↓
4. Atualiza lead_contacts com dados normalizados
   - telefone_e164, ddi, numero_nacional
   - telefone_valido, email_placeholder
   ↓
5. Registra issues em lead_contact_issues
   ↓
6. Se descartarLead = true:
   - Retorna { discarded: true }
   - NÃO segue para classificação/cadência
   ↓
7. Se ok:
   - Continua fluxo normal
   - Classificação → Cadência
```

---

## 6. Matching Melhorado (whatsapp-inbound)

Ordem de busca:
1. **telefone_e164** - Match exato pelo campo normalizado
2. **generatePhoneVariations** - Variações do nono dígito
3. **Últimos 8 dígitos** - Fallback parcial

---

## 7. Componentes UI

### useLeadContactIssues
```typescript
const { data: issues } = useLeadContactIssues({
  leadId: 'lead-123',
  empresa: 'TOKENIZA',
  enabled: true
});
```

### ContactIssuesCard
- Exibe issues pendentes do lead
- Badges coloridos por severidade (ALTA=vermelho, MEDIA=amarelo, BAIXA=cinza)
- Botão para resolver issue (ADMIN/CLOSER)
- Não renderiza se não há issues

---

## 8. DDIs Conhecidos

```typescript
const DDI_CONHECIDOS = ['55', '1', '34', '351', '33', '49', '44', '39', '81', '86'];
```

Telefones com DDI não reconhecido são marcados como `DADO_SUSPEITO`.

---

## 9. Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useLeadContactIssues.ts` | Criado |
| `src/components/leads/ContactIssuesCard.tsx` | Criado |
| `src/pages/LeadDetail.tsx` | Modificado |
| `supabase/functions/sgt-webhook/index.ts` | Modificado |
| `supabase/functions/whatsapp-inbound/index.ts` | Modificado |

---

## 10. Testes Realizados

| Cenário | Resultado |
|---------|-----------|
| Lead sem telefone e email | ✅ Descartado com issue SEM_CANAL_CONTATO |
| Telefone lixo + email placeholder | ✅ Descartado |
| Telefone BR válido | ✅ Normalizado para E.164 |
| Email placeholder com telefone ok | ✅ Issue MEDIA + continua fluxo |
| WhatsApp inbound matching | ✅ Busca por telefone_e164 primeiro |

---

## 11. Próximos Passos

1. **PATCH 5H-PLUS-B**: Adicionar `lead_discard_log` para auditoria
2. **PATCH 5I**: Dashboard de issues de contato
3. **PATCH 5J**: Integração com API WhatsApp para verificar número
