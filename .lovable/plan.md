

# Criação Automática de Ramais via API Zadarma

## Contexto
A API Zadarma oferece `POST /v1/pbx/internal/create/` para criar ramais e `GET /v1/pbx/internal/` para listar os existentes (já implementado no proxy). O fluxo proposto permite criar ramais diretamente do CRM sem acessar o painel Zadarma.

## Plano

### 1. Adicionar actions no `zadarma-proxy`
- **`create_extension`**: `POST /v1/pbx/internal/create/` — cria ramal no PBX Zadarma (precisa usar método POST em vez de GET)
- **`delete_pbx_extension`**: `POST /v1/pbx/internal/delete/` — remove ramal do PBX
- Refatorar `zadarmaRequest` para aceitar método HTTP (GET/POST), já que criação/deleção exigem POST

### 2. Adicionar action "Sincronizar Ramais" no proxy
- **`sync_extensions`**: chama `GET /v1/pbx/internal/` para listar todos os ramais do PBX, retorna lista com `extension_number` e `sip_login` (formato `XXXXXX-NNN`)

### 3. Atualizar aba "Ramais" no `ZadarmaConfigPage.tsx`
- **Botão "Sincronizar do Zadarma"**: puxa ramais via `sync_extensions`, mostra lista com checkbox para selecionar quais importar
- **Botão "Criar Ramal"**: formulário inline com campo de número (3 dígitos), chama `create_extension` via proxy, depois sincroniza automaticamente
- **Auto-preenchimento de SIP Login**: ao sincronizar, preenche automaticamente o `sip_login` de cada ramal já mapeado no CRM
- **Vincular a usuário**: após importar/criar, permite selecionar o usuário CRM para vincular

### 4. Fluxo do usuário
1. Clica "Criar Ramal" → digita número (ex: 108) → API cria no Zadarma
2. Sistema busca automaticamente o SIP login gerado
3. Seleciona o vendedor do CRM para vincular
4. Salva na tabela `zadarma_extensions` com `sip_login` preenchido

## Detalhe técnico
A função `zadarmaRequest` atual só faz GET. Para POST, precisa de uma variante que envie parâmetros no body em vez de query string, mantendo a mesma assinatura HMAC.

