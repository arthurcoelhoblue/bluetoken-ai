

## Plano: Refatorar Zadarma para config global (não por empresa)

### Contexto
Diferente do WhatsApp (onde cada empresa tem sua própria API key e conexão), a telefonia Zadarma usa **uma única conta/API compartilhada** entre todas as empresas. A diferenciação é feita apenas nos **ramais por usuário**. Cada empresa apenas habilita/desabilita o uso.

### Alterações

#### 1. Banco: Tornar `zadarma_config` global
- Remover constraint de empresa única da `zadarma_config` — transformar em config singleton (uma única row sem filtro por empresa)
- Adicionar coluna `empresas_ativas TEXT[]` para controlar quais empresas usam telefonia
- Migrar o registro existente (BLUE) para o novo modelo

#### 2. Atualizar `zadarma-proxy` edge function
- Buscar config global (sem filtro por empresa) — `.single()` direto
- Manter validação de que a empresa do usuário está em `empresas_ativas`

#### 3. Atualizar `zadarma-webhook` edge function
- Buscar config global ao invés de por empresa

#### 4. Refatorar hooks (`useZadarma.ts`)
- `useZadarmaConfig` — remover parâmetro `empresa`, buscar config global
- `useSaveZadarmaConfig` — salvar sem empresa
- Ramais continuam por empresa (já correto)

#### 5. Refatorar UI (`ZadarmaConfigPage.tsx`)
- Aba **Configuração**: remover seletor de empresa, mostrar config global única com API Key/Secret + checkboxes de empresas ativas
- Aba **Ramais**: manter filtro por empresa (cada empresa tem seus ramais)
- Aba **Estatísticas**: manter filtro por empresa
- Remover `EMPRESAS` hardcoded, carregar dinamicamente da tabela `empresas`

