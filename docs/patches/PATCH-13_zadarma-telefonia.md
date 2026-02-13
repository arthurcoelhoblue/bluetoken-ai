# PATCH 13 — Integração Zadarma Telefonia

## Resumo
Integração de telefonia VoIP Zadarma ao Blue CRM: softphone WebRTC, click-to-call, registro automático de chamadas via webhook, histórico de chamadas em deals, player de gravação inline e página admin de configuração.

## Tabelas Criadas
- `zadarma_config` — Credenciais API por empresa (ADMIN-only)
- `zadarma_extensions` — Mapeamento ramal PBX ↔ usuário CRM
- `calls` — Registro de chamadas com auto-vinculo contact/deal
- `call_events` — Log raw de eventos webhook

## View
- `call_stats_by_user` — Estatísticas agregadas por vendedor/mês (SECURITY INVOKER)

## Edge Functions
- `zadarma-webhook` — Recebe eventos do PBX Zadarma (IP whitelist + HMAC-SHA1)
- `zadarma-proxy` — Proxy seguro para API Zadarma com credenciais por empresa

## Componentes
- `ZadarmaPhoneWidget` — Softphone flutuante com dialpad e timer
- `ClickToCallButton` — Botão reutilizável para ligar com um clique
- `DealCallsPanel` — Histórico de chamadas na timeline do deal

## Página
- `/admin/zadarma` — Configuração API keys, ramais e estatísticas

## Segurança
- RLS com `get_user_empresa()` para isolamento multi-tenant
- Webhook policies restritas a `service_role`
- Config table restrita a ADMIN
