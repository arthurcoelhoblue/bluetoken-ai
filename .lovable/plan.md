

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

## O que NÃO usamos e está disponível

### Alta prioridade (valor direto pro CRM)

**1. Estatísticas detalhadas — `/v1/statistics/` e `/v1/statistics/pbx/`**
- Custo por chamada, duração faturada, destino, disposition detalhado
- Estatísticas da central com `is_recorded`, `pbx_call_id`
- Filtro por período, SIP, paginação
- **Valor**: Dashboard financeiro de telefonia (quanto gastou por vendedor/período)

**2. Envio de SMS — `POST /v1/sms/send/`**
- Enviar SMS para contatos diretamente do CRM
- Retorna custo, status de envio, números negados
- Templates de SMS disponíveis via `/v1/sms/templates/`
- Remetentes disponíveis via `/v1/sms/senderid/`
- **Valor**: Cadências multicanal (WhatsApp + SMS + Ligação)

**3. Status online dos ramais — `/v1/pbx/internal/<N>/status/`**
- Verificar se o vendedor está online/disponível no ramal
- **Valor**: Mostrar status de disponibilidade dos vendedores no CRM, distribuição inteligente de chamadas

**4. Reconhecimento de fala (Speech Recognition) — `/v1/pbx/record/transcript/`**
- Resultado com palavras individuais (timestamps de início/fim) e frases por canal
- Status: `in progress`, `recognized`, `ready for recognize`, `error`
- Lançar reconhecimento manual via `POST`
- **Valor**: Já usamos parcialmente, mas podemos usar o resultado por canal (separar vendedor do cliente)

**5. Configuração de webhooks via API — `/v1/pbx/callinfo/` e `/v1/pbx/webhook/`**
- GET para ver webhooks atuais, PUT para configurar URL e ativar/desativar notificações
- Ativar/desativar: `notify_start`, `notify_end`, `notify_answer`, `notify_out_start`, `notify_out_end`, `notify_internal`
- Webhook de `speech_recognition` e `sms`
- **Valor**: Auto-configuração do webhook pelo admin sem ir no painel Zadarma

### Média prioridade

**6. Custo de chamada por destino — `/v1/info/price/`**
- Preço por minuto para qualquer número antes de ligar
- **Valor**: Mostrar custo estimado antes do vendedor ligar

**7. Tarifário atual — `/v1/info/current_tariff/`**
- Segundos usados (total, móvel, fixo, speech recognition)
- Custo do plano, nome, período
- **Valor**: Painel admin com consumo do plano

**8. Números virtuais — `/v1/direct_numbers/`**
- Lista de números comprados, status, país, canais, renovação automática, custo mensal
- **Valor**: Inventário de números no admin

**9. Informações da extensão — `/v1/pbx/internal/<N>/info/`**
- CallerID, gravação, linhas, supervisor status
- **Valor**: Configuração avançada de ramais no admin

**10. Encaminhamento (Redirecionamento) — `/v1/sip/redirection/`**
- Ver/alterar para onde redireciona chamadas quando vendedor não atende
- Condições: always, noanswer
- **Valor**: Configurar fallback de chamadas pelo CRM

### Baixa prioridade

**11. Cenários IVR — `/v1/pbx/ivr/`**
- Criar/editar/excluir menus de voz (URA)
- Estratégias de fila: random, roundrobin, leastrecent
- **Valor**: Configuração de URA pelo admin (complexo)

**12. Callback widget — `/v1/statistics/callback_widget/`**
- Estatísticas do widget de retorno de chamada do site
- **Valor**: Se usarem o widget Zadarma no site

**13. eSIM — `/v1/esim/`**
- Pacotes de dados, gestão de eSIM
- **Valor**: Irrelevante para CRM

**14. Gestão de SIPs — `/v1/sip/`**
- Criar/deletar SIPs, alterar senha, CallerID
- **Valor**: Gestão avançada (raramente necessário)

**15. Documentos e números novos — `/v1/documents/`, `/v1/direct_numbers/order/`**
- Comprar números, upload de documentos
- **Valor**: Operacional, melhor feito no painel Zadarma

## Resumo: O que recomendo implementar

```text
PRIORIDADE 1 (valor imediato):
├─ Estatísticas + custos → Dashboard financeiro de telefonia
├─ SMS → Envio de SMS pelo CRM (integrar com cadências)
├─ Status online ramais → Disponibilidade dos vendedores
└─ Auto-config webhooks → Setup automático pelo admin

PRIORIDADE 2 (melhorias):
├─ Custo por destino → Preview antes de ligar
├─ Info do tarifário → Consumo no admin
├─ Números virtuais → Inventário no admin
└─ Encaminhamento → Config de fallback pelo CRM

PRIORIDADE 3 (nice-to-have):
├─ IVR/URA → Config avançada
└─ Info detalhada de extensão → Admin avançado
```

Qual grupo de prioridade quer que eu implemente primeiro, ou quer escolher funcionalidades específicas?

