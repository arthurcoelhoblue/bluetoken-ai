

## Diagnóstico: Controle de números WhatsApp não funciona na Tokeniza

### Situação atual no banco

| Conexão | phone_number_id | is_default | is_active |
|---------|-----------------|------------|-----------|
| *(sem label)* | 1009376255595711 | **true** | **false** |
| Comercial - Tokeniza BR | 1054747871049688 | false | true |

### Problemas identificados

1. **ConnectionPicker esconde com ≤1 conexão ativa**: A query filtra `is_active = true`, retorna só 1 resultado, e o picker desaparece (`connections.length <= 1 → return null`). O usuário não vê qual número está ativo nem pode confirmar a seleção.

2. **Conexão inativa ainda marcada como `is_default = true`**: No backend (`channel-resolver.ts`), o fallback sem `connectionId` busca `is_default = true AND is_active = true` → não encontra nada → cai para "any active" → funciona por sorte, mas semanticamente o `is_default` está errado.

3. **Sem feedback visual de qual número está sendo usado**: Mesmo quando o picker está oculto, o usuário não sabe por qual número a mensagem está saindo.

### Solução

#### 1. ConnectionPicker: mostrar mesmo com 1 conexão (modo informativo)
Em vez de `return null` quando há ≤1 conexão, exibir um badge/chip com o número ativo (não-interativo, apenas informativo). Isso dá visibilidade ao usuário sobre qual número está sendo usado. Manter a lógica de `Select` para 2+.

#### 2. Limpar `is_default` da conexão inativa
Quando uma conexão é desativada (`is_active = false`), o `is_default` deveria ser removido e transferido para outra conexão ativa. Duas opções:
- **Opção A**: Trigger no banco que ao setar `is_active = false`, move `is_default = true` para a próxima conexão ativa da mesma empresa.
- **Opção B**: Corrigir no admin settings (UI) ao desativar — atualizar `is_default` automaticamente.

Vou implementar a **Opção A** (trigger), pois cobre todos os cenários (admin, API direta, etc.).

#### 3. Correção imediata dos dados
Executar SQL para transferir `is_default` da conexão inativa para a ativa na Tokeniza.

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/conversas/ConnectionPicker.tsx` | Mostrar chip informativo quando há 1 conexão em vez de esconder |
| Migração SQL | Trigger para auto-transferir `is_default` ao desativar; fix data Tokeniza |

