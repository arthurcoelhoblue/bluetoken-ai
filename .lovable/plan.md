

## Diagnóstico: Respostas do Lead Não Chegam

### Problemas Identificados (3 causas raiz)

---

### Problema 1: Mensageria NÃO envia respostas de volta (webhook não configurado)

A Mensageria (`dev-mensageria.grupoblue.com.br`) é usada para **enviar** mensagens, mas não tem nenhum webhook configurado para **receber** respostas e encaminhá-las ao nosso sistema.

- `whatsapp-inbound` não tem NENHUM log recente — nunca é chamada
- Não existe nenhuma configuração de webhook callback no sistema
- As mensagens INBOUND que existem (de ontem) vieram via Blue Chat (`bc-` prefix), não via Mensageria

**Ação necessária (externa):** Configurar na Mensageria um webhook de callback apontando para:
```
POST https://xdjvlcelauvibznnbrzb.supabase.co/functions/v1/whatsapp-inbound
Header: X-API-Key: <WHATSAPP_INBOUND_SECRET>
```

---

### Problema 2: Contatos BLUE_LABS têm `telefone_e164 = NULL`

O contato Arthur Botin (BLUE_LABS) tem `telefone: 351910506655` mas `telefone_e164: NULL`. Mesmo que o webhook receba a resposta, a busca por telefone falhará porque `whatsapp-inbound` busca por `telefone_e164` na tabela `contacts`.

**Correção no código:**
- No `whatsapp-inbound`, adicionar fallback de busca pelo campo `telefone` (não só `telefone_e164`) na tabela `contacts`
- Garantir que ao criar/atualizar contatos, `telefone_e164` seja preenchido

---

### Problema 3: `normalizePhone` assume números brasileiros

A função `normalizePhone` adiciona `55` ao início de números com 11 dígitos. Para números internacionais como `351910506655` (Portugal), isso gera `55351910506655` — incorreto.

**Correção no código:**
- Não assumir DDI 55 se o número já tiver 12+ dígitos
- Usar o telefone raw para matching quando a normalização falhar

---

### Plano de Implementação

1. **Corrigir `whatsapp-inbound`**:
   - Melhorar `normalizePhone` para não assumir DDI brasileiro em números longos
   - No fallback CRM (`contacts`), buscar também pelo campo `telefone` (não só `telefone_e164`)
   - Adicionar busca por últimos 8-9 dígitos como fallback

2. **Preencher `telefone_e164` nos contatos BLUE_LABS**:
   - Migration para normalizar telefones existentes que têm `telefone` mas não `telefone_e164`

3. **Documentar configuração do webhook na Mensageria** (ação manual do usuário):
   - A Mensageria precisa ser configurada para enviar POSTs com as respostas dos leads para o endpoint `whatsapp-inbound`

