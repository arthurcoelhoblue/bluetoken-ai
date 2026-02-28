
# Mapeamento Completo da API Zadarma — O que usamos vs O que está disponível

## Endpoints implementados no proxy

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
| `/v1/info/price/` | `get_price` | ✅ Custo por destino (preview antes de ligar) |
| `/v1/direct_numbers/` | `get_direct_numbers` | ✅ Números virtuais (inventário admin) |
| `/v1/sip/redirection/` | `get_redirection`, `set_redirection` | ✅ Encaminhamento de chamadas |
| `/v1/pbx/internal/<N>/info/` | `get_extension_info` | ✅ Info detalhada de extensão |

## Status de implementação

### ✅ Prioridade 1 (Concluída)
- Dashboard financeiro com custos por chamada/período
- Status online dos ramais (polling 30s)
- Auto-configuração de webhook via API
- Info do tarifário atual
- ❌ SMS (descartado — pouco usado no Brasil)

### ✅ Prioridade 2 (Concluída)
- Custo por destino → Preview antes de ligar (botão $ no ClickToCallButton)
- Números virtuais → Aba "Números" no admin
- Encaminhamento → Aba "Encaminhamento" no admin com config por ramal

### Pendente (Prioridade 3 — nice-to-have)
- IVR/URA → Config avançada
- Info detalhada de extensão → Admin avançado (proxy pronto, falta UI)
