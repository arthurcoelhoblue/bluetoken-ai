

# Diagnóstico: Templates Tokeniza não foram inseridos

A migration anterior que deveria popular os templates, cadências, FAQs e produtos da Tokeniza **não foi efetivamente criada no banco**. Atualmente existem apenas 17 templates, todos da empresa BLUE.

Como o hook `useTemplates` filtra por `activeCompanies`, se você está com TOKENIZA selecionada, a lista aparece vazia.

## Plano

Recriar a migration SQL para inserir todos os dados da Tokeniza com as correções já discutidas:

1. **7 produtos** (TOKENIZA_PLATFORM, IMOVEL, AGRO, FINANCE, STARTUP, AUTO, ATLETA)
2. **Seções de conhecimento** (GERAL, PITCH, RISCOS, ESTRUTURA_JURIDICA)
3. **8 FAQs** com terminologia corrigida
4. **14 templates de mensagem** (WhatsApp + Email) com dados atualizados (7 mil investidores, 30M TVL, taxa 1.5%, "mercado de transações subsequentes")
5. **4 cadências** (Inbound, MQL Quente, Carrinho Abandonado, Upsell)
6. **Steps das cadências** vinculados aos templates

Todos os dados serão inseridos com `ON CONFLICT DO NOTHING` para segurança.

