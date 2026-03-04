

## Problema

O PATCH sync usa credenciais de UMA única conexão (padrão ou especificada) para buscar templates da Meta, mas tenta sincronizar templates locais de TODAS as conexões. Templates vinculados a WABAs diferentes nunca são encontrados no mapa.

## Correção

**Arquivo:** `supabase/functions/whatsapp-template-manager/index.ts` — seção PATCH (linhas 271-344)

### Lógica nova:

1. **Se `connectionId` fornecido**: manter comportamento atual (sync só dessa conexão)
2. **Se `connectionId` NÃO fornecido**: buscar todas as `whatsapp_connections` ativas da empresa, e para cada uma:
   - Resolver credenciais Meta via `resolveMetaCloudConfig(supabase, empresa, conn.id)`
   - Buscar templates da Meta dessa WABA
   - Buscar templates locais vinculados a essa `connection_id`
   - Fazer o matching e atualizar status
3. **Fallback de matching**: se `metaMap.get(codigo)` falhar, tentar `metaMap.get(codigo.replace(/_[a-f0-9]{4,}$/, ''))` para templates clonados
4. **Logging**: logar templates não encontrados no mapa da Meta para debug

### Estrutura do código:

Extrair a lógica de sync em uma função auxiliar `syncConnection(config, connectionId?)` e chamá-la uma vez por conexão ativa quando `connectionId` não é fornecido.

