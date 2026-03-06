

# Diagnóstico: Lead do Elementor (mpuppe.com/criptomoedas-tokens) não criou deal

## Causa raiz identificada

O formulário `criptomoedas_tokens` está configurado corretamente no `elementor_form_mappings` (empresa `BLUE_LABS`, pipeline `Funil Comercial`, stage `4f638e96`). O webhook Elementor recebeu a submissão e retornou 200 ao WordPress. Porém, ao chamar `lp-lead-ingest`, a criação do contato falhou com:

```
"duplicate key value violates unique constraint idx_contacts_telefone_e164_empresa_unique"
```

O fluxo de deduplicação do `lp-lead-ingest` verifica duplicação apenas por **email** (linha 106-112). Se o email é novo mas o **telefone** já existe para outro contato ativo na mesma empresa, o `INSERT` falha no unique index `(telefone_e164, empresa) WHERE is_active = true`. O erro é capturado mas o lead simplesmente é marcado como `error` — nenhum deal é criado.

Isso significa que qualquer lead com telefone já cadastrado (mesmo com email diferente) falha silenciosamente.

## Solução

**Arquivo: `supabase/functions/lp-lead-ingest/index.ts`**

Adicionar deduplicação por telefone **além** da deduplicação por email. Quando o email não encontra contato existente, verificar também se existe contato com o mesmo `telefone_e164`. Se encontrar, reusar o contact existente (como já faz para email) em vez de tentar criar um novo que vai falhar no unique constraint.

```
Fluxo corrigido:
1. Buscar contato por email → encontrou? Reusar
2. Se não encontrou por email, normalizar telefone
3. Se telefone_e164 válido, buscar contato por telefone_e164 + empresa → encontrou? Reusar
4. Se não encontrou por nenhum, criar novo contato
5. Verificar deal aberto existente → se não tem, criar deal
```

Mudança concreta (~15 linhas):
- Após a checagem de email (linha 106-112), adicionar lookup por `telefone_e164` quando `existingContact` é null e o telefone é válido
- Isso evita o INSERT que falha e permite criar o deal normalmente vinculado ao contato existente

Nenhuma mudança de schema é necessária.

