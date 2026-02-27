
# Corrigir Priorização de Empresa no Inbound da Mensageria

## Problema Identificado

Quando uma mensagem inbound chega via Mensageria, o telefone pode existir em múltiplas empresas (ex: `+5561999999999` existe em TOKENIZA e BLUE). O código atual escolhe o lead com `updated_at` mais recente, ignorando qual empresa tem a Mensageria habilitada.

Resultado: mensagens da Mensageria caem na empresa errada (TOKENIZA) em vez da BLUE_LABS (que é a única com mensageria configurada de verdade).

## Causa Raiz

Na última alteração, removi a lógica que verificava `integration_company_config` para priorizar empresas com mensageria ativa. A intenção estava certa (não bloquear inbound), mas o efeito colateral foi perder o critério de desempate.

## Solução

Modificar a função `findLeadByPhone` e o fallback de contacts CRM para **priorizar empresas com mensageria ativa** quando há múltiplos matches para o mesmo telefone, sem nunca bloquear a mensagem.

### Lógica de priorização (3 níveis):
1. Lead/Contact com **cadência ativa** (já existe)
2. Lead/Contact em **empresa com mensageria habilitada** (novo)
3. Lead/Contact **mais recente** por `updated_at` (fallback atual)

### Alterações no arquivo `supabase/functions/whatsapp-inbound/index.ts`:

1. **Criar função auxiliar `getEmpresasComMensageria`** - Consulta `integration_company_config` para obter empresas com `channel='mensageria'` e `enabled=true`

2. **Alterar `findLeadByPhone`** - Na seção de E.164 matches (linha ~282), após verificar cadências ativas, adicionar segundo critério: priorizar lead cuja empresa está na lista de empresas com mensageria ativa, antes de cair no fallback de "mais recente"

3. **Alterar fallback de contacts CRM** (linha ~608) - Mesmo princípio: quando buscar em contacts, priorizar matches de empresas com mensageria ativa

4. **Manter a regra de nunca bloquear** - Se nenhuma empresa com mensageria ativa for encontrada, aceitar o match mais recente normalmente (comportamento atual preservado)

### Pseudocódigo da priorização:

```text
matches = leads ordenados por updated_at DESC

1. Buscar match com cadencia ativa -> retorna se encontrar
2. Buscar match em empresa com mensageria ativa -> retorna se encontrar  
3. Retorna o mais recente (fallback)
```

Isso garante que mensagens da Mensageria da BLUE_LABS sempre caiam na BLUE_LABS quando o telefone existir em múltiplas empresas, sem bloquear nada.
