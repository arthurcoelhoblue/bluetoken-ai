

# Submeter 7 templates WhatsApp da Tokeniza à Meta

## Situação atual
7 templates WhatsApp da Tokeniza com `meta_status = LOCAL`, prontos para submissão. A edge function `whatsapp-template-manager` já suporta POST individual para criar templates na Meta.

## Plano

Criar uma nova edge function `whatsapp-template-batch-submit` que:

1. Recebe `empresa` como parâmetro
2. Busca todos os templates `LOCAL` + `WHATSAPP` dessa empresa
3. Para cada template, extrai as variáveis `{{1}}`, `{{2}}` do conteúdo e monta os `components` no formato Meta (BODY com parâmetros exemplo)
4. Submete cada um via API Meta (`POST /message_templates`)
5. Atualiza o `meta_status` para `PENDING` no banco
6. Retorna resumo (quantos submetidos, erros)

### Mapeamento dos templates → Meta components

Cada template será submetido como categoria `MARKETING` com componente BODY contendo as variáveis detectadas automaticamente. Exemplo para `tkn_saudacao_inbound` (1 variável):

```json
{
  "name": "tkn_saudacao_inbound",
  "category": "MARKETING",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{1}}! 👋 Sou da equipe Tokeniza...",
      "example": { "body_text": [["João"]] }
    }
  ]
}
```

### Após deploy
Invocar a função para submeter todos os 7 templates de uma vez.

