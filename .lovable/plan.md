
# Mapeamento Completo da API Zadarma — O que usamos vs O que está disponível

## O que já usamos no CRM

| Endpoint | Action no proxy | Uso |
|---|---|---|
| `/v1/info/balance/` | `get_balance`, `test_connection` | Saldo e teste de conexão |
| `/v1/pbx/internal/` | `get_pbx_internals` | Lista de ramais |
| `/v1/webrtc/get_key/` | `get_webrtc_key` | Chave WebRTC 72h |
| `/v1/request/callback/` | `click_to_call` | Click-to-call |
| `/v1/pbx/record/request/` | `get_recording` | URL de gravação |
| `/v1/pbx/record/transcript/` | `get_transcript` | Transcrição pós-chamada |
| `/v1/statistics/pbx/` | `get_pbx_statistics` | ✅ Dashboard financeiro |
| `/v1/statistics/` | `get_statistics` | ✅ Estatísticas detalhadas |
| `/v1/info/current_tariff/` | `get_current_tariff` | ✅ Info do plano |
| `/v1/pbx/internal/<N>/status/` | `get_extension_status` | ✅ Status online ramais |
| `/v1/pbx/callinfo/` | `get_webhooks`, `set_webhooks` | ✅ Auto-config webhook |
| `/v1/info/price/` | `get_price` | ✅ Custo por destino |
| `/v1/direct_numbers/` | `get_direct_numbers` | ✅ Números virtuais |

## Implementado na Prioridade 1

- ✅ Dashboard financeiro com custos por chamada/período
- ✅ Status online dos ramais (polling 30s)
- ✅ Auto-configuração de webhook via API
- ✅ Info do tarifário atual
- ❌ SMS (descartado — pouco usado no Brasil)

## Pendente (Prioridade 2)

- Custo por destino → Preview antes de ligar (proxy pronto, falta UI)
- Números virtuais → Inventário no admin (proxy pronto, falta UI)
- Encaminhamento → Config de fallback pelo CRM
