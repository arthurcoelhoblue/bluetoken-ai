# BLUE CRM — MANUAL DO GESTOR

**Configuração, monitoramento e decisão — tudo que o admin precisa**

Para: Administradores, Diretores e Gestores de Vendas  
Versão 6.1 — Fevereiro 2026

---

## Índice

1. [Seu Papel como Gestor](#1-seu-papel-como-gestor)
2. [Cockpit — Visão Executiva Rápida](#2-cockpit--visão-executiva-rápida)
3. [Relatórios e Analytics](#3-relatórios-e-analytics)
4. [Configuração de Funis (Pipeline Config)](#4-configuração-de-funis-pipeline-config)
5. [Campos Customizados](#5-campos-customizados)
6. [Base de Conhecimento — O Que a IA Sabe](#6-base-de-conhecimento--o-que-a-ia-sabe)
7. [Custos de IA — Monitoramento de Gastos](#7-custos-de-ia--monitoramento-de-gastos)
8. [Benchmark de IA](#8-benchmark-de-ia)
9. [Saúde Operacional](#9-saúde-operacional)
10. [Amélia IA (SDR Automática)](#10-amélia-ia-sdr-automática)
11. [Configurações da Amélia IA](#11-configurações-da-amélia-ia)
12. [Gestão de Usuários](#12-gestão-de-usuários)
13. [Perfis de Acesso](#13-perfis-de-acesso)
14. [Templates de Mensagem](#14-templates-de-mensagem)
15. [Categorias de Perda e Confronto IA](#15-categorias-de-perda-e-confronto-ia)
16. [Regras Automáticas do Pipeline](#16-regras-automáticas-do-pipeline)
17. [Webhooks (Integrações Externas)](#17-webhooks-integrações-externas)
18. [Telefonia](#18-telefonia)
19. [Formulários de Captura](#19-formulários-de-captura)
20. [Importação de Dados](#20-importação-de-dados)
21. [Gestão de Equipe — O Que Monitorar](#21-gestão-de-equipe--o-que-monitorar)
22. [CRON Jobs — O Motor Automático](#22-cron-jobs--o-motor-automático)
23. [Uso no Celular](#23-uso-no-celular)
24. [E Se Der Errado? (Troubleshooting)](#24-e-se-der-errado-troubleshooting)

---

## 1. Seu Papel como Gestor

Como gestor/admin, você tem **acesso total** ao sistema. Além de tudo que vendedores e CSMs veem, você configura funis, monitora custos de IA, acompanha performance da equipe e garante que o sistema está funcionando corretamente.

Este manual cobre as funcionalidades **EXCLUSIVAS** de gestores e admins.

---

## 2. Cockpit — Visão Executiva Rápida

> **O que é:** Sua dashboard executiva. Mostra em uma única tela o panorama completo de vendas.
> **Como chegar:** Menu lateral → Comercial → **Cockpit**.
> **O que você vai ver:** Gráficos e números mostrando pipeline, performance e conversão.

O Cockpit mostra:
- Pipeline total (R$) e por etapa
- Deals ganhos vs perdidos no período
- Performance por vendedor
- Velocidade do funil (tempo médio por etapa)
- Taxa de conversão por etapa

💡 **Dica:** Use o Cockpit para reuniões semanais de pipeline. Tudo que você precisa está em uma tela.

---

## 3. Relatórios e Analytics

> **O que é:** Gráficos e análises detalhadas de performance de vendas.
> **Como chegar:** Menu lateral → Comercial → **Relatórios**.
> **O que você vai ver:** Dashboard com gráficos interativos e filtros por período.

### 3.1 Relatórios Gerais

1. Menu lateral → Comercial → **Relatórios**
2. Gráficos interativos de: funil, conversão, receita, atividades, pipeline por vendedor
3. Filtre por período, equipe ou vendedor

### 3.2 Analytics Executivo (apenas Admin)

1. Relatórios → botão **"Executivo"** no canto superior
2. Dashboard avançada com:
   - **Revenue forecast:** previsão de receita calculada pela IA diariamente
   - **ICP Insights:** perfil ideal de cliente aprendido dos dados (quais deals ganham vs perdem)
   - **Análise de perda:** motivos mais comuns, padrões identificados pela IA
   - **Projeção de meta:** % de probabilidade de bater a meta baseada no pipeline atual

💡 **Dica:** A previsão de receita melhora com mais dados históricos. Após 3 meses, ela é bem precisa.

### 3.3 Relatório Semanal Automático

Todo **domingo às 20h**, a IA gera um relatório semanal automático com: deals fechados, perdidos, pipeline movimentado, destaques e alertas. Você recebe uma notificação no sininho 🔔 quando está pronto.

---

## 4. Configuração de Funis (Pipeline Config)

> **O que é:** Onde você define as etapas do funil de vendas da empresa.
> **Como chegar:** Menu lateral → Configuração → **Funis**.
> **O que você vai ver:** Lista de funis existentes. Cada funil mostra suas etapas em ordem.

### 4.1 Editar Etapas

1. Clique no funil que deseja editar
2. Veja as etapas listadas em ordem
3. Para cada etapa, configure:

| Campo | O Que É | Exemplo |
|-------|---------|---------|
| Nome | Nome da etapa | Qualificação, Proposta, Negociação, Fechamento |
| Cor | Cor de exibição no Kanban (quadro de colunas) | Verde, Azul, Amarelo, Vermelho |
| SLA (dias) | Tempo máximo que um deal pode ficar nesta etapa | 7 dias, 14 dias, 3 dias |
| É Ganho? | Marque se esta etapa significa deal ganho | Sim para "Fechamento Ganho" |
| É Perdido? | Marque se esta etapa significa deal perdido | Sim para "Perdido" |
| Ordem | Posição da etapa no funil | 1, 2, 3, 4... |

⚠️ **Atenção:** Alterar etapas de um funil ativo **não move** deals existentes. Os deals ficam na etapa em que estão.

### 4.2 Criar Novo Funil

1. Na página de Funis, clique em **"+ Novo Funil"**
2. Dê um nome (ex: "Funil Tokeniza", "Funil Corporativo")
3. Adicione as etapas com SLA para cada uma
4. Salve

💡 **Dica:** Funis diferentes servem para processos de venda diferentes. Ex: um funil curto para vendas rápidas, outro longo para enterprise.

---

## 5. Campos Customizados

> **O que é:** Campos extras que você cria para deals, contatos ou organizações que não existem por padrão.
> **Como chegar:** Menu lateral → Configuração → **Campos**.
> **O que você vai ver:** Lista de campos existentes, organizados por entidade (Deal, Contato, Organização).

### Criar Novo Campo

1. Clique em **"+ Novo Campo"**
2. Selecione onde o campo aparece: **Deal**, **Contato** ou **Organização**
3. Defina: nome, tipo (texto, número, data, seleção, múltipla escolha), se é obrigatório
4. Se for seleção: adicione as opções (ex: "Produto A", "Produto B", "Produto C")
5. Salve

O campo aparecerá automaticamente na aba "Campos" do detalhe do deal, contato ou organização.

---

## 6. Base de Conhecimento — O Que a IA Sabe

> **O que é:** Cadastro de produtos e serviços da empresa. A Amélia usa essas informações para responder leads.
> **Como chegar:** Menu lateral → Configuração → **Base de Conhecimento**.
> **O que você vai ver:** Lista de produtos cadastrados com nome, descrição e FAQ.

### Cadastrar Produto

1. Clique em **"+ Novo Produto"**
2. Preencha: nome, descrição, preço, benefícios, FAQ (perguntas e respostas comuns)
3. Salve

⚠️ **Atenção:** Mantenha a base de conhecimento **ATUALIZADA**. Se preços mudaram, atualize aqui. A IA vai usar informações desatualizadas se você não corrigir.

💡 **Dica:** Quanto mais detalhada a descrição e FAQ, melhor a IA responde. Inclua objeções comuns e como contorná-las.

---

## 7. Custos de IA — Monitoramento de Gastos

> **O que é:** Dashboard que mostra quanto a IA está custando para a empresa.
> **Como chegar:** Menu lateral → Configuração → **Custos IA**.
> **O que você vai ver:** Gráficos de custo e tabelas com detalhamento por função e modelo.

### Aba Custos
- Gasto total por período (7/14/30/90 dias)
- Custo por função (copilot-chat, deal-scoring, sdr-intent-classifier, etc)
- Custo por modelo de IA (os motores de IA que processam as informações, como Claude, Gemini, GPT-4o)
- Gráfico de evolução diária

### Aba Adoção
- Quantas vezes cada feature (funcionalidade) de IA foi usada
- Quais vendedores mais usam o Copilot
- Features com uso zero (pode significar desconhecimento da equipe ou problema técnico)

O sistema tem **proteção automática** contra custos excessivos: Copilot tem limite de 60 chamadas/hora por usuário, SDR (pré-vendedora automática) 200/hora. Chamadas que excedem o limite são bloqueadas.

💡 **Dica:** Monitore semanalmente. Se o custo subir subitamente, verifique se alguma função está fazendo chamadas em loop (erro).

---

## 8. Benchmark de IA

> **O que é:** Ferramenta para comparar respostas de diferentes motores de IA em cenários reais do seu CRM.
> **Como chegar:** Menu lateral → Configuração → **Benchmark IA**.
> **O que você vai ver:** Interface para selecionar cenários, rodar teste e comparar respostas lado a lado.

### Passo a passo:

1. Selecione um cenário de teste (ex: classificar intenção de mensagem, gerar resposta para lead)
2. O sistema executa o mesmo prompt (instrução) nos 3 motores de IA
3. Compare as respostas lado a lado
4. Vote na melhor resposta

### Quando usar o Benchmark:

| Cenário | Por Que Usar |
|---------|-------------|
| A IA está dando respostas fracas | Teste se outro motor gera respostas melhores |
| Custo de IA está alto | Teste se um motor mais barato dá resultados equivalentes |
| Lançou produto novo | Verifique se a IA responde corretamente sobre o novo produto |
| Equipe reclamou de sugestões ruins | Compare a qualidade entre modelos para validar |

---

## 9. Saúde Operacional

> **O que é:** Monitor de status de todas as integrações e serviços do sistema.
> **Como chegar:** Menu lateral → Configuração → **Saúde Operacional**.
> **O que você vai ver:** Tabela com cada integração, status (online/offline) e tempo de resposta.

| Integração | O Que Verifica | Frequência |
|-----------|---------------|-----------|
| Banco de Dados | Conexão e tempo de resposta | A cada 5 min |
| Motor de IA Principal | API respondendo, latência | A cada 5 min |
| Motor de IA Backup | API respondendo (fallback) | A cada 5 min |
| WhatsApp | API ativa, taxa de envio | A cada 5 min |
| Telefonia VoIP | Telefonia funcionando | A cada 5 min |
| Servidor de Email | Servidor respondendo | A cada 5 min |

Se qualquer integração falhar **3 vezes consecutivas**, todos os admins recebem notificação de alerta crítico no sininho 🔔.

⚠️ **Atenção:** Se os motores de IA ficarem offline, as funcionalidades de IA ficam indisponíveis (Copilot, scoring, SDR automática). Deals e pipeline continuam funcionando normalmente.

---

## 10. Amélia IA (SDR Automática)

> **O que é:** Painel que mostra como a Amélia está performando como SDR (pré-vendedora digital) automática.
> **Como chegar:** Menu lateral → Automação → **Amélia IA**.
> **O que você vai ver:** Métricas da Amélia: leads atendidos, classificações feitas, escalações, conversas ativas.

### O Que a Amélia Faz Automaticamente

| Ação | Quando | Resultado |
|------|--------|-----------|
| Classifica intenção da mensagem | Toda mensagem recebida | Identifica: interesse compra, dúvida preço, agendamento, etc |
| Detecta lead quente | Quando intenção = alta confiança | Escala para closer (vendedor) via notificação |
| Responde automaticamente | Quando configurado para auto-reply | Envia resposta contextual via WhatsApp/BlueChat |
| Cria deal automaticamente | Quando detecta interesse de compra | Deal aparece no pipeline do closer |
| Qualifica lead (SPIN/BANT) | Durante conversa | Preenche dados de qualificação |

### Ação em Massa

1. Menu lateral → Automação → **Ação em Massa**
2. Envie mensagens personalizadas para múltiplos leads de uma vez
3. A IA personaliza cada mensagem com nome, empresa e contexto do lead

---

## 11. Configurações da Amélia IA

> **O que é:** Onde você configura o comportamento da Amélia — tom de voz, auto-resposta, horários e parâmetros.
> **Como chegar:** Menu lateral → Configuração → **Configurações** → aba **"Amélia"**.
> **O que você vai ver:** Formulário com opções de configuração da IA.

### O que pode ser configurado:

| Configuração | O Que Faz | Exemplo |
|-------------|----------|---------|
| Tom de voz | Define como a Amélia escreve | Formal, Semiformal, Casual |
| Auto-reply | Liga/desliga resposta automática | Ativado = Amélia responde leads sozinha |
| Horário de funcionamento | Quando a Amélia pode responder | 08h-18h dias úteis |
| Temperatura mínima para escalar | Quando avisar o closer | Quente, Morno+Quente |
| Modelo de IA preferido | Qual motor usar como padrão | Claude, Gemini, GPT-4o |

⚠️ **Atenção:** Se desligar o auto-reply, a Amélia para de responder leads automaticamente. Os leads ficarão sem resposta até que um vendedor atenda manualmente.

---

## 12. Gestão de Usuários

> **O que é:** Tela para criar, editar e gerenciar usuários do sistema.
> **Como chegar:** Menu lateral → Configuração → **Configurações** → aba **"Acesso"**.
> **O que você vai ver:** Lista de usuários cadastrados com nome, email, perfil e status.

### Criar Novo Usuário

1. Vá em Configuração → **Configurações** → aba **"Acesso"**
2. Clique no botão **"+ Novo Usuário"**
3. Preencha:
   - **Nome** do colaborador
   - **Email** (será usado para login)
   - **Perfil de acesso** (Vendedor, Admin, CSM, etc)
   - **É vendedor?** (marque se a pessoa deve aparecer como responsável de deals e ter metas)
4. Clique em **"Criar"**
5. O novo usuário receberá um email para definir a senha

### Editar Usuário

1. Na lista de usuários, clique no nome do usuário
2. Altere os dados necessários (perfil, permissões, status)
3. Salve

### Desativar Usuário

Para desativar um usuário sem deletá-lo (mantém o histórico), altere o status para **"Inativo"**. Os deals dele podem ser transferidos para outro vendedor.

⚠️ **Atenção:** Deletar um usuário pode afetar histórico de deals e atividades. Prefira **desativar** em vez de deletar.

---

## 13. Perfis de Acesso

> **O que é:** Conjuntos de permissões que definem o que cada tipo de usuário pode ver e fazer no sistema.
> **Como chegar:** Configuração → Configurações → aba **"Acesso"** → seção **"Perfis de Acesso"**.
> **O que você vai ver:** Lista de perfis (Admin, Vendedor, CSM, etc) com as permissões de cada um.

### O que os perfis controlam:

- **Quais telas** o usuário pode acessar (ex: vendedor não vê Custos IA)
- **Quais ações** pode executar (ex: apenas admin pode criar/deletar funis)
- **Quais dados** pode ver (ex: vendedor vê só seus deals; gestor vê todos)

### Perfis padrão:

| Perfil | Acesso |
|--------|--------|
| **Admin** | Tudo — configuração, relatórios, todos os deals, gestão de usuários |
| **Gestor** | Relatórios, cockpit, deals de todos, sem configuração avançada |
| **Vendedor** | Apenas seus deals, pipeline, metas, conversas |
| **CSM** | Módulo CS completo, seus clientes |

Você pode criar perfis customizados clicando em **"+ Novo Perfil"** e definindo cada permissão individualmente.

---

## 14. Templates de Mensagem

> **O que é:** Modelos pré-escritos de mensagens (WhatsApp, email) que podem ser usados em cadências e envios manuais.
> **Como chegar:** Menu lateral → Automação → **Templates**.
> **O que você vai ver:** Lista de templates com nome, canal (WhatsApp/Email), texto e placeholders.

### Criar Template

1. Clique em **"+ Novo Template"**
2. Defina: nome, canal (WhatsApp ou Email), texto da mensagem
3. Use **placeholders** (campos variáveis) para personalização:
   - `{{nome}}` → nome do contato
   - `{{empresa}}` → nome da empresa
   - `{{produto}}` → produto mencionado
   - `{{vendedor}}` → nome do vendedor responsável
4. Salve

### Exemplo de template:

```
Olá {{nome}}, tudo bem?

Sou {{vendedor}} da Blue. Vi que você demonstrou interesse em {{produto}}.
Posso agendar uma conversa rápida para entender melhor suas necessidades?

Abraço!
```

💡 **Dica:** Templates bons aumentam a taxa de resposta. Personalize com o nome do contato e contexto relevante.

---

## 15. Categorias de Perda e Confronto IA

> **O que é:** Configuração dos motivos de perda de deals e funcionalidade que compara o motivo dado pelo vendedor com a análise da IA.
> **Como chegar:** Configuração → Configurações → aba **"Comercial"** → seção "Categorias de Perda". Pendências de confronto em Menu → **Pendências** → filtro "Motivo de Perda".

### Configurar Categorias de Perda

1. Vá em Configuração → Configurações → aba **"Comercial"**
2. Na seção **"Categorias de Perda"**, veja as categorias existentes
3. Adicione novas categorias conforme necessário (ex: "Preço", "Timing", "Concorrência", "Sem Budget", "Sem Resposta")
4. Cada categoria fica disponível como opção quando um vendedor marca um deal como "Perdido"

### Confronto IA vs Vendedor

Quando um vendedor marca um deal como **perdido** e seleciona o motivo, a IA também analisa o histórico do deal e sugere seu próprio motivo de perda. Se os dois motivos **divergirem**, o deal aparece na tela de **Pendências** como "Confronto de Motivo de Perda".

O gestor então revisa:
- **Motivo do vendedor:** Ex: "Cliente escolheu concorrente"
- **Motivo da IA:** Ex: "Análise indica que o motivo principal foi falta de follow-up — 15 dias sem contato antes da perda"
- **Decisão:** O gestor decide qual motivo é mais preciso e registra

💡 **Dica:** O confronto de motivos é uma ferramenta de **coaching**. Use para conversas construtivas com vendedores sobre o que realmente causou a perda.

---

## 16. Regras Automáticas do Pipeline

> **O que é:** Regras que o sistema executa automaticamente quando certas condições acontecem no pipeline.
> **Como chegar:** Menu lateral → Configuração → **Funis** → selecione o funil → aba **"Regras Automáticas"**.
> **O que você vai ver:** Lista de regras com condição (gatilho) e ação.

### Exemplos de regras:

| Condição (Gatilho) | Ação Automática |
|--------------------|----------------|
| Deal entra na etapa "Proposta" | Criar atividade "Enviar proposta" para o vendedor |
| Deal fica mais de 7 dias em "Negociação" | Notificar gestor |
| Deal marcado como "Ganho" | Criar cliente CS automaticamente |
| Deal sem atividade há 5 dias | Enviar alerta ao vendedor |

### Criar Nova Regra

1. Selecione o funil desejado
2. Clique na aba **"Regras Automáticas"**
3. Clique em **"+ Nova Regra"**
4. Defina a condição (o que dispara a regra)
5. Defina a ação (o que acontece)
6. Ative a regra

⚠️ **Atenção:** Regras automáticas rodam em tempo real. Teste com cuidado antes de ativar em funis com muitos deals.

---

## 17. Webhooks (Integrações Externas)

> **O que é:** Conexões automáticas entre o Blue CRM e sistemas externos. Quando algo acontece no CRM, o webhook envia dados para outro sistema (e vice-versa).
> **Como chegar:** Configuração → Configurações → aba **"Webhooks"**.
> **O que você vai ver:** Lista de webhooks disponíveis com URL e descrição.

### Webhooks disponíveis:

| Webhook | O Que Faz |
|---------|----------|
| SGT Webhook | Recebe eventos do sistema SGT e cria/atualiza deals |
| WhatsApp Inbound | Recebe mensagens de WhatsApp e processa no CRM |
| BlueChat Inbound | Recebe mensagens do BlueChat |
| Capture Form Submit | Recebe dados de formulários de captura |

Para cada webhook, copie a URL e configure no sistema externo. Instruções de autenticação estão disponíveis em cada card.

💡 **Dica:** Webhooks são para integração técnica. Se não tem familiaridade, peça ao time de TI para configurar.

---

## 18. Telefonia

> **O que é:** Integração VoIP (chamadas pela internet) para fazer e receber ligações pelo sistema.
> **Como chegar:** Menu lateral → Configuração → **Telefonia**.
> **O que você vai ver:** Tela de configuração com campos para credenciais e lista de ramais.

### Configurar Telefonia

1. Menu lateral → Configuração → **Telefonia**
2. Cadastre as credenciais da API de telefonia (API Key e Secret)
3. Configure ramais para cada vendedor
4. Ative a gravação de chamadas

### O que acontece quando um vendedor liga pelo sistema:

1. A chamada é **gravada** automaticamente
2. Após a chamada, o áudio é **transcrito pela IA** (vira texto)
3. Uma atividade é **criada automaticamente** no deal
4. O **call-coach** (treinador) analisa a chamada e gera feedback para o vendedor

---

## 19. Formulários de Captura

> **O que é:** Formulários públicos para captura de leads via site ou landing page.
> **Como chegar:** Menu lateral → Automação → **Form de Captura**.
> **O que você vai ver:** Lista de formulários com nome, link público e respostas.

### Criar Formulário

1. Clique em **"+ Novo Formulário"**
2. Configure os campos (nome, email, telefone, empresa, mensagem)
3. Salve e **copie o link público**
4. Publique o link no seu site, landing page ou redes sociais

Quando alguém preenche o formulário: um contato é criado no CRM e a Amélia pode iniciar contato automático.

---

## 20. Importação de Dados

> **O que é:** Ferramenta para importar contatos em massa via planilha.
> **Como chegar:** Menu lateral → Configuração → **Importação**.
> **O que você vai ver:** Área de upload de arquivo e mapeamento de colunas.

### Passo a passo:

1. Prepare uma planilha (CSV ou Excel) com colunas: Nome, Email, Telefone, Empresa
2. Faça **upload** do arquivo
3. **Mapeie** as colunas da planilha para os campos do CRM (ex: "Nome Completo" → "Nome")
4. Revise a **prévia** dos dados
5. Confirme a importação

⚠️ **Atenção:** Dados importados não podem ser "desimportados" facilmente. Faça um teste com 5-10 linhas antes de importar a planilha completa.

---

## 21. Gestão de Equipe — O Que Monitorar

| Frequência | O Que Verificar | Onde |
|-----------|----------------|------|
| **Diário** | SLAs estourados da equipe, deals parados | Pendências (filtrar por equipe) |
| **Diário** | Clientes CS em risco | Dashboard CS |
| **Semanal** | Pipeline por vendedor, taxa de conversão | Cockpit + Relatórios |
| **Semanal** | Custos de IA, adoção de features | Custos IA |
| **Semanal** | Relatório semanal automático | Sininho 🔔 (gerado domingo 20h) |
| **Mensal** | Performance individual, metas | Metas & Comissões |
| **Mensal** | Saúde operacional, integrações | Saúde Operacional |
| **Mensal** | Base de conhecimento atualizada? | Base de Conhecimento |

💡 **Dica:** O relatório semanal automático é seu melhor amigo. Leia todo domingo/segunda. Ele resume tudo que aconteceu.

---

## 22. CRON Jobs — O Motor Automático

O Blue CRM executa **16 tarefas automáticas** em segundo plano. Como gestor, é bom saber o que roda e quando:

| Tarefa | Frequência | O Que Faz |
|--------|-----------|-----------|
| cadence-runner | A cada 15 min | Avança cadências automáticas (envia WhatsApp, email) |
| cs-playbook-runner | A cada 30 min | Executa playbooks de CS |
| integration-health-check | A cada 5 min | Verifica se integrações estão funcionando |
| cs-incident-detector | A cada 2h | Detecta incidências automaticamente |
| copilot-proactive | A cada 4h | Gera insights proativos para vendedores |
| cleanup-rate-limits | Diário 02:00 | Limpa dados antigos de proteção contra excesso |
| follow-up-scheduler | Diário 04:00 | Calcula melhores horários de follow-up |
| deal-scoring | Diário 05:00 | Recalcula score de todos os deals |
| cs-health-calculator | Diário 06:00 | Recalcula health score de clientes |
| revenue-forecast | Diário 06:00 | Atualiza previsão de receita |
| cs-churn-predictor | Diário 07:00 | Calcula risco de churn (cancelamento) |
| cs-renewal-alerts | Diário 08:00 | Envia alertas de renovação próxima |
| cs-daily-briefing | Diário 08:30 | Gera briefing diário para CSMs |
| cs-nps-auto | Diário 09:00 | Envia pesquisas NPS automáticas |
| icp-learner | Domingo 03:00 | Analisa deals ganhos/perdidos para aprender ICP (perfil ideal) |
| weekly-report | Domingo 20:00 | Gera relatório semanal automático |

Todos rodam automaticamente. Se algum falhar, o sistema de health check detecta em até 5 minutos e você é notificado no sininho 🔔.

---

## 23. Uso no Celular

O Blue CRM funciona no celular pelo navegador (Chrome recomendado). Diferenças no celular:

- O **menu lateral** vira um **menu hambúrguer** (☰) no canto superior esquerdo
- Tabelas grandes rolam horizontalmente — deslize para os lados
- Telas de configuração funcionam melhor no computador
- O Cockpit e relatórios são visualizáveis, mas mais confortáveis no desktop

💡 **Dica:** Para tarefas rápidas (checar pendências, ver notificações, aprovar deal), o celular funciona bem. Para configuração e relatórios, prefira o computador.

---

## 24. E Se Der Errado? (Troubleshooting)

| Problema | O Que Fazer |
|----------|-------------|
| **Integração offline no Health Check** | Verifique o sininho 🔔 para detalhes. Se for WhatsApp ou Email, as mensagens ficam na fila e serão enviadas quando voltar. Se for IA, funcionalidades de IA ficam temporariamente indisponíveis |
| **Custo de IA disparou** | Vá em Custos IA e verifique qual função está consumindo mais. Verifique se há algum processo em loop. Se necessário, desative temporariamente a função |
| **Usuário não consegue acessar** | Verifique se o email está correto, se o usuário tem perfil de acesso atribuído e se o status está "Ativo" |
| **Cadência não está avançando** | Verifique se a cadência está com status "Ativa". Verifique no Health Check se a integração de WhatsApp/Email está online |
| **Deals de vendedor sumiram** | Verifique se o vendedor está logado com o email correto. Verifique se o filtro de funil está mostrando o funil correto. Deals de outros vendedores não são visíveis para vendedores comuns |

❓ **Se nada funcionar:** Recarregue a página (F5), saia e entre novamente, ou limpe o cache do navegador. Se persistir, verifique a Saúde Operacional e entre em contato com o suporte técnico.

---

*Blue CRM — Manual do Gestor — Versão 6.1 — Fevereiro 2026*
