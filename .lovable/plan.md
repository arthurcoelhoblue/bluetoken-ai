

# Plano: Importar 18 Templates da Axia no BLUE_LABS e Submeter à Meta

## Resumo

O PDF contém **18 templates** de WhatsApp com corpo, variáveis, categoria (MARKETING ou UTILITY) e botões definidos. O plano é inseri-los no banco como templates locais da BLUE_LABS e disparar a submissão em lote à Meta.

## Templates Identificados

| # | Código | Categoria | Botões |
|---|--------|-----------|--------|
| 1 | axia_intro_dor_fintech | MARKETING | QUICK_REPLY: "Sim, vamos conversar" / "Agora não é o momento" |
| 2 | axia_roi_calculadora | MARKETING | URL: "Calcular meu ROI" |
| 3 | axia_cold_banco_digital | MARKETING | QUICK_REPLY: "Quero análise técnica" / "Me conte mais" / "Não tenho interesse" |
| 4 | axia_cold_wallet | MARKETING | QUICK_REPLY: "Quero diagnóstico" / "Já tenho wallet, mas quero comparar" |
| 5 | axia_cold_tokenizacao | MARKETING | QUICK_REPLY: "Sim, quero conversar" / "Estou só pesquisando" |
| 6 | axia_cold_otc | MARKETING | QUICK_REPLY: "Agendar diagnóstico" / "Manda mais informação" |
| 7 | axia_cold_case_social | MARKETING | URL: "Conhecer a Axia" + QUICK_REPLY: "Quero saber mais" |
| 8 | axia_cold_evento_webinar | MARKETING | URL: "Garantir minha vaga" + QUICK_REPLY: "Não consigo nesse dia" |
| 9 | axia_lead_banco_digital | UTILITY | QUICK_REPLY: "Funciona!" / "Prefiro outro horário" / "Me liga" |
| 10 | axia_lead_wallet | UTILITY | QUICK_REPLY: "Vamos agendar" / "Pode ligar agora" / "Manda por e-mail" |
| 11 | axia_lead_tokenizacao | UTILITY | QUICK_REPLY: "Vamos conversar" / "Prefiro outro horário" |
| 12 | axia_lead_otc | UTILITY | QUICK_REPLY: "Agenda confirmada" / "Me liga" / "Outro horário" |
| 13 | axia_lead_calculadora | UTILITY | QUICK_REPLY: "Agendar demo" / "Os números me surpreenderam" / "Agora não" |
| 14 | axia_lead_site_geral | UTILITY | QUICK_REPLY: "Banking" / "Cripto/Wallet" / "Tokenização" / "Outro" |
| 15 | axia_followup_sem_resposta | MARKETING | QUICK_REPLY: "Vamos agendar" / "Manda material por e-mail" |
| 16 | axia_followup_pos_call | UTILITY | QUICK_REPLY: "Alinhado!" / "Tenho uma dúvida" |
| 17 | axia_followup_proposta | UTILITY | QUICK_REPLY: "Estamos avaliando" / "Tenho dúvidas" / "Vamos fechar" |
| 18 | axia_reengajamento_30d | MARKETING | QUICK_REPLY: "Sim, vamos retomar" / "Ainda não é o momento" |

## Etapas Técnicas

### 1. Migração SQL — Inserir os 18 templates
- Tabela: `message_templates`
- Empresa: `BLUE_LABS`
- Canal: `WHATSAPP`
- `meta_status`: `LOCAL`
- `meta_category`: MARKETING ou UTILITY conforme o PDF
- `connection_id`: será atribuído à conexão ativa da BLUE_LABS (consultada dinamicamente)
- Variáveis já no formato numérico `{{1}}`, `{{2}}` etc.
- Conteúdo completo extraído do PDF

### 2. Atualizar Edge Function `whatsapp-template-manager`
- O batch-submit atualmente **hardcoda** `category: 'MARKETING'` para todos os templates
- Alterar para usar `meta_category` armazenado no banco (com fallback para MARKETING)
- Incluir botões (QUICK_REPLY / URL) como componentes na submissão à Meta

### 3. Disparar submissão em lote
- Após a migração, o batch-submit (`POST ?action=batch-submit&empresa=BLUE_LABS`) será chamado automaticamente ou via UI
- Cada template será submetido com sua categoria correta e botões

