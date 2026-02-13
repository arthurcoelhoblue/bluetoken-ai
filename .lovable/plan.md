
## Patch 13: Integração Zadarma — Fase 1

### Resumo

Integrar telefonia Zadarma ao Blue CRM: softphone WebRTC no browser, click-to-call, webhooks para registro automatico de chamadas, historico de chamadas no deal, player de gravacao e pagina admin de configuracao.

---

### Correções vs PDF (adaptações ao schema real)

| PDF assume | Schema real | Correção |
|------------|------------|----------|
| Zadarma API keys como secrets globais | Sistema multi-tenant (BLUE/TOKENIZA) | Tabela `zadarma_config` com chaves por empresa |
| WebRTC SDK como dependência NPM | SDK Zadarma é script externo carregado via CDN | Carregar script dinamicamente + wrapper React |
| `calls.lead_id` TEXT | CRM migrou para `contacts` | Usar `contact_id` UUID FK contacts |
| Sem menção a RLS | Sprint de qualidade reforçou RLS | Policies com `get_user_empresa()` |

---

### Arquitetura

```text
+------------------+     +------------------+     +------------------+
| ZadarmaPhone     |     | zadarma-proxy    |     | Zadarma API      |
| Widget (React)   |---->| (Edge Function)  |---->| (api.zadarma.com)|
| WebRTC + SIP     |     | HMAC-SHA1 auth   |     |                  |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         | Webhooks
                                                         v
+------------------+     +------------------+     +------------------+
| DealCallsPanel   |<----| calls (table)    |<----| zadarma-webhook  |
| (React)          |     | call_events      |     | (Edge Function)  |
+------------------+     +------------------+     +------------------+
```

**Fluxo de chamada:**
1. Vendedor clica "Ligar" no deal/contato
2. PhoneWidget abre com numero pre-preenchido
3. Widget usa WebRTC/SIP para conectar via Zadarma
4. Zadarma envia webhooks (NOTIFY_OUT_START, NOTIFY_ANSWER, NOTIFY_OUT_END, NOTIFY_RECORD)
5. Edge function `zadarma-webhook` registra eventos na tabela `calls`
6. Gravacao disponivel no painel do deal com player inline

---

### Ordem de implementação

#### Fase 1: Migration SQL

**Tabela `zadarma_config`**:
- `id` UUID PK
- `empresa` empresa_tipo UNIQUE (uma config por empresa)
- `api_key` TEXT NOT NULL (Zadarma Key)
- `api_secret` TEXT NOT NULL (Zadarma Secret)
- `webhook_enabled` BOOLEAN DEFAULT true
- `webrtc_enabled` BOOLEAN DEFAULT true
- `created_at`, `updated_at` TIMESTAMPTZ
- RLS: SELECT/UPDATE apenas ADMIN

**Tabela `zadarma_extensions`**:
- `id` UUID PK
- `empresa` empresa_tipo NOT NULL
- `extension_number` TEXT NOT NULL (ramal PBX, ex: "100")
- `user_id` UUID FK profiles NOT NULL
- `sip_login` TEXT (login SIP para WebRTC)
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ
- UNIQUE(empresa, extension_number)
- RLS: SELECT para authenticated; INSERT/UPDATE/DELETE para ADMIN

**Tabela `calls`**:
- `id` UUID PK
- `empresa` empresa_tipo NOT NULL
- `deal_id` UUID FK deals (nullable — vinculo automatico)
- `contact_id` UUID FK contacts (nullable — vinculo por telefone)
- `user_id` UUID FK profiles (vendedor que fez/recebeu)
- `direcao` TEXT CHECK ('INBOUND', 'OUTBOUND')
- `status` TEXT CHECK ('RINGING', 'ANSWERED', 'MISSED', 'BUSY', 'FAILED') DEFAULT 'RINGING'
- `pbx_call_id` TEXT NOT NULL (ID unico Zadarma)
- `caller_number` TEXT
- `destination_number` TEXT
- `duracao_segundos` INTEGER DEFAULT 0
- `recording_url` TEXT
- `started_at` TIMESTAMPTZ
- `answered_at` TIMESTAMPTZ
- `ended_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ
- RLS: SELECT filtrado por empresa via `get_user_empresa()`; INSERT/UPDATE via service_role

**Tabela `call_events`**:
- `id` UUID PK
- `call_id` UUID FK calls
- `event_type` TEXT NOT NULL (NOTIFY_START, NOTIFY_ANSWER, etc.)
- `payload` JSONB NOT NULL
- `created_at` TIMESTAMPTZ
- RLS: SELECT para ADMIN; INSERT via service_role

**View `call_stats_by_user`** (SECURITY INVOKER):
- Fonte: `calls` + `profiles`
- Agrega: total_chamadas, atendidas, perdidas, duracao_media, duracao_total
- Agrupado por: user_id, user_nome, empresa, periodo (mes)

#### Fase 2: Types — `src/types/patch13.ts`

- `ZadarmaConfig` (empresa, api_key, api_secret, webhook/webrtc enabled)
- `ZadarmaExtension` (extension_number, user_id, sip_login)
- `Call` (deal_id, contact_id, direcao, status, duracao, recording_url)
- `CallEvent` (event_type, payload)
- `CallStats` (total, atendidas, perdidas, duracao_media)
- `PhoneWidgetState` ('idle' | 'dialing' | 'ringing' | 'active' | 'ended')

#### Fase 3: Edge Function — `supabase/functions/zadarma-webhook/index.ts`

- Recebe POSTs do Zadarma PBX (no-JWT)
- Valida IP origem (185.45.152.40/30) via header
- Valida Signature HMAC-SHA1 com api_secret da empresa
- Eventos tratados:
  - `NOTIFY_START` / `NOTIFY_OUT_START`: cria registro em `calls` com status RINGING
  - `NOTIFY_ANSWER`: atualiza status para ANSWERED, registra answered_at
  - `NOTIFY_END` / `NOTIFY_OUT_END`: atualiza duracao, status final, ended_at
  - `NOTIFY_RECORD`: atualiza recording_url
- Auto-vincula contact_id por telefone (busca em contacts)
- Auto-vincula deal_id (deal ABERTO mais recente do contato)
- Registra todos os eventos raw em `call_events`

#### Fase 4: Edge Function — `supabase/functions/zadarma-proxy/index.ts`

- Proxy seguro para chamadas a API Zadarma
- Busca credenciais da tabela `zadarma_config` pela empresa do usuario
- Assina requests com HMAC-SHA1 conforme documentação Zadarma
- Acoes suportadas:
  - `get_webrtc_key`: obter chave WebRTC (valida 72h)
  - `click_to_call`: iniciar callback (ramal -> numero)
  - `get_recording`: obter URL de download da gravacao
  - `get_pbx_internals`: listar ramais disponiveis
  - `get_balance`: consultar saldo da conta

#### Fase 5: Hook — `src/hooks/useZadarma.ts`

- `useZadarmaConfig(empresa)` — busca config da empresa
- `useZadarmaExtensions(empresa)` — lista mapeamento ramais
- `useSaveZadarmaConfig()` — mutation para salvar config
- `useSaveExtension()` / `useDeleteExtension()` — CRUD ramais
- `useDealCalls(dealId)` — chamadas vinculadas ao deal
- `useCallStats(empresa)` — estatisticas por vendedor
- `useZadarmaProxy()` — wrapper para chamar zadarma-proxy
- `useWebRTCKey(empresa)` — obter/cachear chave WebRTC

#### Fase 6: Componente — `src/components/zadarma/ZadarmaPhoneWidget.tsx`

- Softphone flutuante no canto inferior direito
- Design dark mode com gradiente slate-900/800
- Estados: minimizado (botao circular), idle (dialpad), dialing, active, ended
- Dialpad numerico com input de numero
- Durante chamada ativa: nome do contato, numero, timer, botoes mute/hangup
- Escuta evento global `bluecrm:dial` para pre-preencher numero
- Carrega SDK WebRTC Zadarma via script dinamico
- Apenas renderiza se usuario tem ramal mapeado

#### Fase 7: Componente — `src/components/zadarma/ClickToCallButton.tsx`

- Componente reutilizavel (icone telefone ao lado de numeros)
- Dispara `window.dispatchEvent(new CustomEvent('bluecrm:dial', { detail: { number, contactName, dealId } }))`
- Props: `phoneNumber`, `contactName?`, `dealId?`

#### Fase 8: Componente — `src/components/zadarma/DealCallsPanel.tsx`

- Painel de historico de chamadas na pagina do deal
- Lista chamadas com icones direcao (entrada/saida), status colorido, duracao, data
- Ao expandir: player de audio para gravacao
- Integrado na aba Timeline do DealDetailSheet

#### Fase 9: Pagina — `src/pages/ZadarmaConfigPage.tsx`

- Pagina admin para configurar integracao Zadarma
- Tres secoes:
  1. **API Keys**: campos Key/Secret por empresa, URL webhook readonly, botao testar conexao
  2. **Ramais**: tabela mapeamento ramal PBX <-> usuario CRM, botao buscar ramais automaticamente
  3. **Estatisticas**: tabela de chamadas por vendedor (total, atendidas, perdidas, duracao media)

#### Fase 10: Integrações (DealDetailSheet, AppLayout, Routing)

- **DealDetailSheet.tsx**: adicionar `DealCallsPanel` na aba Timeline (abaixo do DealCadenceCard)
- **ClickToCallButton**: integrar nos campos de telefone do ContactDetailSheet e DealDetailSheet
- **AppLayout.tsx**: renderizar `ZadarmaPhoneWidget` como overlay global (condicional: se usuario tem ramal)
- **App.tsx**: rota `/admin/zadarma` com requiredRoles `['ADMIN']`
- **AppSidebar.tsx**: item "Telefonia" no grupo Configuracao
- **screenRegistry.ts**: registrar `telefonia_zadarma`
- **settings.ts**: adicionar Zadarma ao array INTEGRATIONS e WEBHOOKS
- **supabase/config.toml**: registrar edge functions com verify_jwt

---

### Pontos de atenção (por que é delicado)

1. **WebRTC/SIP**: O SDK Zadarma precisa ser carregado como script externo. A conexao SIP depende de HTTPS e permissao de microfone do browser. Fallback: usar `click_to_call` (callback) se WebRTC falhar.

2. **Seguranca do Webhook**: Validacao dupla — IP whitelist (185.45.152.40/30) + HMAC-SHA1 signature. As chaves API ficam na tabela `zadarma_config` (nao em env vars) porque sao por empresa.

3. **Vinculo automatico**: O webhook precisa buscar contato por telefone (normalizando formato) e depois encontrar o deal ABERTO mais recente desse contato. Se nao encontrar, a chamada fica sem vinculo mas é registrada.

4. **Gravacoes**: A URL de gravacao chega via NOTIFY_RECORD, que pode demorar minutos apos a chamada. O player precisa tratar caso a URL ainda nao esteja disponivel.

5. **RLS**: Tabela `calls` usa `get_user_empresa()` para filtro multi-tenant. Webhooks usam `service_role` para INSERT.

---

### Seção técnica — Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar (4 tabelas + 1 view + RLS) |
| `src/types/patch13.ts` | Criar |
| `src/hooks/useZadarma.ts` | Criar |
| `src/components/zadarma/ZadarmaPhoneWidget.tsx` | Criar |
| `src/components/zadarma/ClickToCallButton.tsx` | Criar |
| `src/components/zadarma/DealCallsPanel.tsx` | Criar |
| `src/pages/ZadarmaConfigPage.tsx` | Criar |
| `supabase/functions/zadarma-webhook/index.ts` | Criar |
| `supabase/functions/zadarma-proxy/index.ts` | Criar |
| `src/components/deals/DealDetailSheet.tsx` | Editar (adicionar DealCallsPanel) |
| `src/components/layout/AppLayout.tsx` | Editar (renderizar PhoneWidget global) |
| `src/App.tsx` | Editar (rota /admin/zadarma) |
| `src/components/layout/AppSidebar.tsx` | Editar (item Telefonia) |
| `src/config/screenRegistry.ts` | Editar (registrar tela) |
| `src/types/settings.ts` | Editar (INTEGRATIONS + WEBHOOKS) |
| `supabase/config.toml` | Atualizar (2 edge functions) |

---

### Checklist de validação

1. Tabelas `zadarma_config`, `zadarma_extensions`, `calls`, `call_events` criadas com RLS
2. View `call_stats_by_user` funcional
3. Edge function `zadarma-webhook` recebe e processa eventos
4. Edge function `zadarma-proxy` assina requests HMAC-SHA1
5. PhoneWidget renderiza no AppLayout (apenas se usuario tem ramal)
6. Click-to-call dispara evento e abre widget com numero
7. DealCallsPanel mostra historico de chamadas no deal
8. Player de gravacao funciona inline
9. ZadarmaConfigPage: salvar API keys, mapear ramais, ver stats
10. Rota `/admin/zadarma` acessivel apenas ADMIN
11. Item "Telefonia" visivel no sidebar
12. Vinculo automatico contact/deal funciona no webhook
