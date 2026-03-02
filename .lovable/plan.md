

## Submeter Templates da Blue para a Meta

### Situação Atual

Existem **12 templates** da Blue com `meta_status = 'LOCAL'` que precisam ser enviados à Meta para aprovação. O endpoint `whatsapp-template-manager` (POST) já faz a submissão individual, mas:

1. Os templates têm `conteudo` em texto simples com variáveis `{{primeiro_nome}}` — precisam ser convertidos para o formato Meta (`{{1}}` + exemplo)
2. Os nomes (`codigo`) estão em UPPERCASE — Meta exige lowercase com underscores
3. Não há lógica de envio em lote

### Plano

**1. Criar endpoint de batch submit** no `whatsapp-template-manager` (nova rota PUT ou query param `?action=batch-submit`)

- Buscar todos os templates `LOCAL` da empresa no banco
- Para cada template:
  - Converter `codigo` para lowercase (ex: `BLUE_INBOUND_DIA0` → `blue_inbound_dia0`)
  - Converter `{{primeiro_nome}}` para `{{1}}` no body component
  - Montar `components` no formato Meta: `[{ type: "BODY", text: "...", example: { body_text: [["Cliente"]] } }]`
  - Categoria: `MARKETING` (são mensagens de prospecção)
  - Submeter via POST à Meta API
  - Atualizar `meta_status`, `meta_template_id`, `meta_components` no banco
- Retornar resumo: quantos enviados, quantos falharam

**2. Deploy e execução**

- Redeployar `whatsapp-template-manager`
- Chamar o endpoint via curl para submeter todos os templates da Blue de uma vez

### Templates que serão enviados

| Código | Nome |
|--------|------|
| BLUE_INBOUND_DIA0 | Boas-vindas Blue |
| BLUE_INBOUND_DIA1 | Follow-up D+1 Blue |
| BLUE_INBOUND_DIA3 | Follow-up D+3 Blue |
| FOLLOWUP_INBOUND | Follow-up Inbound - Blue |
| BLUE_INBOUND_DIA2 | Inbound - Dia 2 |
| BLUE_IR_URGENTE_IMEDIATO | IR Urgente - Contato Imediato |
| BLUE_IR_URGENTE_DIA0 | IR Urgente - Dia 0 |
| BLUE_IR_DIA1 | IR Urgente - Dia 1 |
| BLUE_IR_FOLLOWUP_1H | IR Urgente - Follow-up 1h |
| BLUE_IR_URGENTE_2H | IR Urgente - Follow-up 2h |
| SAUDACAO_INBOUND | Saudação Inbound - Blue |

Todos serão submetidos como categoria **MARKETING**, idioma **pt_BR**.

