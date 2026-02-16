# Amélia CRM — Manual Geral do Sistema

**Versão 1.0 — Uma visão completa e integrada do seu CRM Inteligente**

- **Para**: Toda a equipe (Vendedores, SDRs, Closers, CSMs, Gestores e Administradores)
- **Autor**: Manus AI
- **Data**: 15 de Fevereiro de 2026

---

## Introdução: O Que é o Amélia CRM?

O **Amélia CRM** é uma plataforma de gestão de relacionamento com o cliente (CRM) projetada para otimizar e automatizar os processos de vendas e sucesso do cliente (CS). Diferente de CRMs tradicionais, o Amélia CRM incorpora uma assistente de Inteligência Artificial, a **Amélia**, que atua como um membro proativo da sua equipe.

> A Amélia não é apenas uma ferramenta, mas uma copiloto que analisa dados, classifica leads, sugere as próximas ações, automatiza a comunicação e fornece insights estratégicos para acelerar o crescimento do negócio. O objetivo é simples: permitir que sua equipe foque em construir relacionamentos e fechar negócios, enquanto a Amélia cuida do trabalho repetitivo e analítico.

### O Modelo Multi-Tenant: BLUE e TOKENIZA

O Amélia CRM foi desenvolvido para operar em um modelo **multi-tenant**, o que significa que ele pode gerenciar as operações de múltiplas empresas de forma isolada dentro da mesma plataforma. Atualmente, o sistema atende a duas entidades distintas:

| Empresa | Foco de Negócio | Implicações no CRM |
| :--- | :--- | :--- |
| **BLUE** | Foco em serviços de contabilidade e imposto de renda. | Funis de venda, cadências e produtos específicos para o público da BLUE. |
| **TOKENIZA** | Foco em tokenização de ativos e investimentos. | Funis de venda, cadências e produtos voltados para o mercado de investimentos. |

Você verá filtros e seletores de "Empresa" em várias telas do sistema. É crucial garantir que você está trabalhando no contexto da empresa correta para acessar os dados e as configurações apropriadas.

### Arquitetura Simplificada do Sistema

Para entender como o Amélia CRM funciona, é útil conhecer sua arquitetura básica, que consiste em três camadas principais.

`[DIAGRAMA: Arquitetura Simplificada - Frontend (React) -> Backend (Supabase) -> Edge Functions (Deno)]`

1.  **Frontend**: A interface com a qual você interage, construída com tecnologias modernas (React, Vite, TypeScript) para ser rápida e responsiva.
2.  **Backend (Supabase)**: O cérebro e a memória do sistema. Ele armazena todos os dados (clientes, deals, contatos) em um banco de dados PostgreSQL e gerencia a autenticação e segurança.
3.  **Edge Functions (IA)**: Pequenos programas que rodam na "borda" da internet, próximos ao usuário. São eles que executam as tarefas de inteligência artificial, como analisar mensagens, classificar leads e gerar respostas.

---

## Índice Geral

1.  [Primeiros Passos: Acesso e Navegação](#1-primeiros-passos-acesso-e-navegação)
2.  [Visão Geral da Interface](#2-visão-geral-da-interface)
3.  [Jornada do Lead: Da Captura ao Fechamento](#3-jornada-do-lead-da-captura-ao-fechamento)
4.  [Jornada do Cliente: Do Onboarding à Renovação](#4-jornada-do-cliente-do-onboarding-à-renovação)
5.  [Funcionalidades Essenciais para Todos](#5-funcionalidades-essenciais-para-todos)
    -   [Meu Dia: Sua Central de Comando](#51-meu-dia-sua-central-de-comando)
    -   [Pipeline: Gerenciando Oportunidades](#52-pipeline-gerenciando-oportunidades)
    -   [Contatos e Organizações](#53-contatos-e-organizações)
    -   [Conversas: WhatsApp e BlueChat Integrados](#54-conversas-whatsapp-e-bluechat-integrados)
    -   [Amélia Copilot: Sua Assistente Pessoal](#55-amélia-copilot-sua-assistente-pessoal)
6.  [Automação Inteligente](#6-automação-inteligente)
    -   [Cadências: Automação de Contato](#61-cadências-automação-de-contato)
    -   [Amélia SDR: A Pré-Vendedora Digital](#62-amélia-sdr-a-pré-vendedora-digital)
7.  [Perfis de Acesso (RBAC)](#7-perfis-de-acesso-rbac)
8.  [Glossário de Termos](#8-glossário-de-termos)
9.  [Troubleshooting Básico](#9-troubleshooting-básico)

---

## 1. Primeiros Passos: Acesso e Navegação

### 1.1. Acessando o Sistema

O acesso ao Amélia CRM é feito através de um navegador web. Recomendamos o uso do **Google Chrome** para a melhor compatibilidade.

`[IMAGEM: Tela de login do Amélia CRM]`

**Passo a passo:**
1.  Abra o navegador e insira o endereço fornecido pelo seu administrador.
2.  Na tela de login, utilize seu **email corporativo** e a **senha** inicial.
3.  Clique no botão **"Entrar"**.

> **Segurança**: Nunca compartilhe sua senha. O sistema utiliza um Controle de Acesso Baseado em Papéis (RBAC), e sua conta tem permissões específicas. Se um colega precisar de acesso, solicite uma conta ao administrador.

### 1.2. Navegação Principal

A interface é dividida em três áreas principais:

-   **Menu Lateral Esquerdo**: Contém os links para todas as principais seções do CRM.
-   **Barra Superior**: Oferece acesso rápido à busca global, notificações, ao Amélia Copilot e às configurações do seu perfil.
-   **Área de Conteúdo Principal**: Onde o conteúdo da seção selecionada é exibido.

`[IMAGEM: Tela principal destacando o Menu Lateral, a Barra Superior e a Área de Conteúdo]`

**Busca Global (Atalho: `Ctrl+K` ou `Cmd+K`)**
A forma mais rápida de navegar. Pressione o atalho em qualquer tela para abrir a barra de busca. Digite o nome de um contato, deal, empresa ou tela para encontrar e navegar instantaneamente.

---

## 2. Visão Geral da Interface

O Amélia CRM é organizado em módulos lógicos, acessíveis pelo menu lateral. A visibilidade dos módulos depende do seu perfil de acesso.

| Módulo Principal | Seções | Objetivo Principal |
| :--- | :--- | :--- |
| **Área de Trabalho** | Meu Dia, Pipeline, Contatos, Organizações, Conversas, Pendências | Ferramentas para a operação diária de vendas e relacionamento. |
| **Comercial** | Metas, Cockpit, Relatórios, Leads Quentes, Renovação | Análise de performance, gestão de metas e identificação de oportunidades. |
| **Automação** | Amélia IA, Cadências, Templates, Formulários de Captura | Ferramentas para automatizar tarefas e escalar a comunicação. |
| **Sucesso do Cliente** | Dashboard CS, Clientes, Pesquisas, Incidências, Playbooks | Módulo dedicado à gestão e retenção da carteira de clientes. |
| **Configuração** | Funis, Campos, Integrações, Custos IA, Usuários, etc. | Área administrativa para configurar e manter o sistema (acesso restrito). |


---

## 3. Jornada do Lead: Da Captura ao Fechamento

Entender o ciclo de vida de um lead no Amélia CRM é fundamental. Esta seção descreve o fluxo completo, desde o momento em que um lead entra no sistema até se tornar um cliente.

`[DIAGRAMA: Fluxo da Jornada do Lead: Captura -> Classificação IA -> Cadência -> Qualificação -> Oportunidade (Deal) -> Fechamento]`

**Etapas da Jornada:**

1.  **Captura**: Um lead (contato potencial) entra no sistema. Isso pode acontecer de várias formas:
    *   **Formulário de Captura**: Preenchimento de um formulário no site da BLUE ou da TOKENIZA.
    *   **Importação de Lista**: Um administrador importa uma lista de contatos.
    *   **Criação Manual**: Um vendedor cria o contato diretamente no CRM.
    *   **Webhook (SGT)**: Sistemas externos, como o SGT (Sistema de Gestão de Tráfego), enviam o lead automaticamente.

2.  **Análise e Classificação (Amélia IA)**: Assim que o lead é criado, a Amélia entra em ação.
    *   **Enriquecimento de Dados**: A IA busca informações públicas para complementar o perfil do lead.
    *   **Classificação Comercial**: O lead é classificado com base no seu perfil (ICP - Ideal Customer Profile) e no seu nível de interesse. Ele recebe uma **temperatura** (Frio, Morno, Quente) e uma **prioridade** (P1, P2, P3).

3.  **Engajamento Automatizado (Cadência)**: Com base na sua classificação, o lead é automaticamente inserido em uma **cadência** de comunicação.
    *   Uma cadência é uma sequência pré-definida de contatos (WhatsApp, E-mail, Tarefa de ligação).
    *   **Exemplo**: Um lead "Quente" pode receber um WhatsApp imediato, enquanto um lead "Frio" recebe um e-mail educativo 2 dias depois.

4.  **Interação e Qualificação (Amélia SDR)**: Se o lead responde a uma das mensagens da cadência, a **Amélia SDR** (Sales Development Representative) assume a conversa.
    *   Ela utiliza técnicas de qualificação (como BANT ou SPIN) para entender as necessidades do lead.
    *   Se a Amélia identifica uma intenção clara de compra, ela classifica o lead como **MQL (Marketing Qualified Lead)** ou **SQL (Sales Qualified Lead)**.

5.  **Criação da Oportunidade (Deal)**: Quando um lead é qualificado como SQL, a Amélia automaticamente:
    *   Cria um **Deal** (Oportunidade de Venda) no **Pipeline**.
    *   Atribui o deal ao vendedor (Closer) responsável.
    *   Notifica o vendedor através de um alerta no sistema.

6.  **Negociação Humana (Closer)**: O vendedor assume o controle.
    *   Ele recebe o deal com todo o histórico de conversas e as análises da IA.
    *   O vendedor utiliza o CRM para registrar atividades, enviar propostas e negociar.

7.  **Fechamento**: O vendedor move o deal para a etapa final do funil.
    *   **Ganho**: O lead se torna um cliente. Ele é movido para o módulo de Sucesso do Cliente (CS).
    *   **Perdido**: A negociação não teve sucesso. O motivo da perda é registrado para análise futura.

---

## 4. Jornada do Cliente: Do Onboarding à Renovação

Após um deal ser marcado como "Ganho", o ciclo de vida do cliente dentro do Amélia CRM começa. O foco muda de aquisição para **retenção e satisfação**, gerenciado pelo módulo de Sucesso do Cliente (CS).

`[DIAGRAMA: Fluxo da Jornada do Cliente: Onboarding -> Monitoramento (Health Score) -> Engajamento (Playbooks) -> Análise de Risco (Churn Prediction) -> Renovação]`

**Etapas da Jornada:**

1.  **Onboarding e Cadastro no CS**: O novo cliente é cadastrado no módulo de CS. O sistema começa a monitorar sua saúde desde o primeiro dia.

2.  **Monitoramento Contínuo (Health Score)**: Diariamente, a Amélia calcula o **Health Score** (Pontuação de Saúde) de cada cliente, uma nota de 0 a 100. Este cálculo considera múltiplos fatores:
    *   **Engajamento**: O cliente está usando a plataforma? Está interagindo?
    *   **Satisfação (NPS/CSAT)**: O cliente está respondendo positivamente às pesquisas de satisfação?
    *   **Suporte**: O cliente abriu muitos chamados de suporte (incidências)?

3.  **Engajamento Proativo (Playbooks)**: O sistema não apenas monitora, mas age. **Playbooks** são automações acionadas por gatilhos específicos.
    *   **Exemplo**: Se o Health Score de um cliente cai abaixo de 40, um playbook pode ser iniciado para: 1) Notificar o CSM responsável, 2) Enviar um e-mail de check-in, e 3) Criar uma tarefa para o CSM ligar para o cliente.

4.  **Análise Preditiva de Risco (Predição de Churn)**: A cada 24 horas, um modelo de IA analisa os padrões de comportamento e calcula a **probabilidade de churn** (cancelamento) para cada cliente nos próximos 90 dias.
    *   Clientes com alta probabilidade de churn são marcados como "Em Risco", permitindo que a equipe de CS atue preventivamente.

5.  **Alertas e Incidências**: O sistema gera **incidências** automaticamente quando detecta problemas, como uma nota de NPS muito baixa ou uma queda brusca no uso. Isso centraliza a gestão de problemas e garante que nada seja esquecido.

6.  **Renovação**: Conforme a data de renovação do contrato se aproxima, o sistema alerta o CSM. O histórico de saúde e satisfação do cliente é uma ferramenta poderosa para garantir a renovação e identificar oportunidades de upsell.


---

## 5. Funcionalidades Essenciais para Todos

Esta seção detalha as ferramentas do dia a dia que todos os usuários do Amélia CRM utilizarão, independentemente de seu papel específico.

### 5.1. Meu Dia: Sua Central de Comando

É a primeira tela que você vê após o login. O "Meu Dia" é um dashboard pessoal e dinâmico, projetado para organizar suas prioridades e destacar o que é mais importante.

`[IMAGEM: Tela "Meu Dia" com destaque para os KPIs, Insights da Amélia e Próximas Ações.]`

**Componentes Principais:**

-   **KPIs do Dia**: Quatro métricas chave que oferecem um pulso rápido da sua performance: **Pipeline Aberto** (valor total em negociação), **Total Ganho** (valor já fechado no período), **Deals Abertos** (quantidade de negociações ativas) e **SLAs Estourados** (negociações que excederam o tempo máximo em uma etapa).
-   **Insights da Amélia**: Sugestões e alertas gerados pela IA a cada 4 horas. Por exemplo: *"O Deal com a Empresa X está parado há 5 dias. Considere uma ação de follow-up."*
-   **Próxima Melhor Ação**: A Amélia analisa todos os seus deals e recomenda a ação mais crítica a ser tomada em seguida, com base em urgência e probabilidade de sucesso.
-   **Atividades Próximas**: Uma lista de suas tarefas agendadas, como ligações, reuniões e e-mails a serem enviados.

> **Dica Pro**: A seção "SLAs Estourados" é seu indicador de urgência. Se este número for maior que zero, vá diretamente para a tela de **Pendências** (no menu principal) para resolver os gargalos.

### 5.2. Pipeline: Gerenciando Oportunidades

O Pipeline é a representação visual do seu processo de vendas. Ele organiza todos os seus **Deals** (oportunidades) em colunas que representam cada etapa do funil de vendas.

`[IMAGEM: Visão do Pipeline no formato Kanban, mostrando colunas de etapas e cards de deals.]`

**Como usar o Pipeline:**

1.  **Navegação**: Acesse clicando em **"Pipeline"** no menu lateral.
2.  **Visualização Kanban**: Os deals são exibidos como "cards". Para mover um deal de uma etapa para outra, simplesmente **clique, arraste e solte** o card na coluna desejada.
3.  **Detalhes do Deal**: Clicar em um card abre um painel lateral com todo o histórico, dados, insights da IA e ações possíveis para aquele deal.
4.  **Criar Novo Deal**: Utilize o botão **"+ Novo Deal"** no canto superior direito para criar uma nova oportunidade manualmente.

> **Dica Pro**: Use os filtros no topo da tela do Pipeline para segmentar sua visão por **Responsável** (para gestores), **Temperatura** (Frio, Morno, Quente) ou **Tags** específicas. Isso ajuda a focar em diferentes segmentos do seu funil.

### 5.3. Contatos e Organizações

Esta é a sua agenda de endereços dentro do CRM. A seção **Contatos** armazena informações sobre pessoas, enquanto **Organizações** armazena informações sobre empresas.

-   **Busca Rápida**: Utilize a barra de busca para encontrar rapidamente qualquer contato ou organização por nome, e-mail ou telefone.
-   **Visão 360°**: Clicar em um contato ou organização abre uma página de detalhes com todas as informações associadas: deals em andamento, histórico de conversas, atividades passadas e dados customizados.

### 5.4. Conversas: WhatsApp e BlueChat Integrados

O módulo de **Conversas** centraliza todas as suas interações via WhatsApp e BlueChat (o chat do site) em uma única interface, similar a um "WhatsApp Web" corporativo.

`[IMAGEM: Tela de Conversas, mostrando a lista de contatos à esquerda e a janela de chat à direita.]`

**Funcionalidades Chave:**

-   **Caixa de Entrada Unificada**: Responda a todas as mensagens sem precisar sair do CRM.
-   **Contexto Automático**: Cada conversa é automaticamente vinculada ao registro do contato e seus deals, mantendo o histórico organizado.
-   **Identificação da IA**: Mensagens enviadas pela **Amélia SDR** são claramente marcadas com a etiqueta "IA", para que você saiba quando a automação está ativa.
-   **Takeover da Conversa**: Se a Amélia está conversando com um lead e você deseja assumir, basta clicar no botão **"Assumir Conversa"**. A partir desse momento, a automação é pausada e você assume o controle manual.

### 5.5. Amélia Copilot: Sua Assistente Pessoal

O Copilot é a interface de chat para interagir diretamente com a Amélia. Ele está sempre acessível através do ícone da Amélia na barra superior.

**O que você pode pedir ao Copilot:**

-   *"Resuma o histórico do deal com a Empresa Y."*
-   *"Escreva um e-mail de follow-up para o contato João Silva."*
-   *"Quais são meus deals mais quentes no momento?"*
-   *"Mostre-me os clientes com risco de churn acima de 60%."

> **Dica Pro (Copilot em Contexto)**: Se você abrir o Copilot enquanto visualiza um deal ou um cliente específico, a Amélia **automaticamente saberá o contexto**. Você pode simplesmente perguntar *"Resuma isso"* ou *"Qual a próxima ação aqui?"* sem precisar especificar o nome do deal ou cliente.


---

## 6. Automação Inteligente

O verdadeiro poder do Amélia CRM reside em sua capacidade de automação. As duas principais ferramentas para isso são as Cadências e a Amélia SDR.

### 6.1. Cadências: Automação de Contato

Uma **Cadência** é uma sequência de ações de comunicação (e-mails, mensagens de WhatsApp, tarefas de ligação) que são executadas automaticamente em um cronograma pré-definido. O objetivo é garantir um follow-up consistente sem esforço manual.

**Como funciona:**
1.  Um administrador cria e configura as cadências (ex: "Inbound Lead Frio", "Pós-Reunião").
2.  Um lead é adicionado a uma cadência (manualmente por um vendedor ou automaticamente pela IA).
3.  O sistema começa a executar os passos. Para ações automáticas (e-mail, WhatsApp), a mensagem é enviada sem intervenção. Para ações manuais (ligação), uma tarefa é criada para o vendedor no dia agendado.

> A cadência é pausada automaticamente assim que o lead responde, evitando que ele receba mensagens automáticas enquanto já está engajado em uma conversa.

### 6.2. Amélia SDR: A Pré-Vendedora Digital

A **Amélia SDR** é a funcionalidade de IA que atua como uma pré-vendedora. Ela é responsável por interagir com leads em estágios iniciais para qualificá-los.

**Principais Funções:**
-   **Resposta Imediata**: Responde a novos leads em segundos, 24/7.
-   **Classificação de Intenção**: Analisa a mensagem do lead para entender sua intenção (pedir preço, agendar demo, tirar dúvida).
-   **Qualificação Conversacional**: Faz perguntas para qualificar o lead com base em frameworks como BANT ou SPIN.
-   **Escalação para Humanos**: Quando um lead é qualificado ou a conversa se torna muito complexa, a Amélia notifica um vendedor humano para assumir (takeover).

---

## 7. Perfis de Acesso (RBAC)

O Amélia CRM utiliza um sistema de **Controle de Acesso Baseado em Papéis (RBAC)** para garantir a segurança e a organização dos dados. Cada usuário possui um perfil que define exatamente o que ele pode ver e fazer no sistema.

| Perfil | Descrição | Acessos Chave |
| :--- | :--- | :--- |
| **Vendedor (Closer/SDR)** | Focado na execução de vendas e qualificação. | Vê apenas seus próprios deals, contatos e atividades. Acesso limitado a relatórios. |
| **CSM (Customer Success)** | Focado na retenção e satisfação de clientes existentes. | Acesso total ao módulo de Sucesso do Cliente. Não vê o pipeline de vendas. |
| **Marketing** | Focado na geração de leads e comunicação. | Acesso a templates, formulários de captura e cadências. |
| **Gestor de Vendas** | Supervisiona a equipe de vendas. | Vê o pipeline de toda a sua equipe, acesso a relatórios de performance e ao Cockpit. |
| **Administrador (Admin)** | Acesso total e irrestrito ao sistema. | Pode configurar funis, usuários, integrações, custos de IA e todas as demais configurações. |
| **Auditor** | Perfil de apenas leitura para fins de compliance. | Pode ver todos os dados, mas não pode editar ou criar nada. |

---

## 8. Glossário de Termos

| Termo | Definição |
| :--- | :--- |
| **Amélia** | A assistente de Inteligência Artificial integrada ao CRM. |
| **Cadência** | Sequência de ações de comunicação automatizadas para engajar leads. |
| **Churn** | Termo que significa cancelamento. A "predição de churn" calcula a probabilidade de um cliente cancelar. |
| **Closer** | O vendedor responsável por negociar e fechar o deal. |
| **Copilot** | A interface de chat para conversar diretamente com a Amélia. |
| **Deal** | Uma oportunidade de negócio em andamento, representada como um card no Pipeline. |
| **Edge Function** | Um programa de IA que executa tarefas específicas (ex: classificar uma mensagem). |
| **Health Score** | Uma pontuação de 0 a 100 que indica a "saúde" de um cliente no módulo de CS. |
| **ICP** | Ideal Customer Profile (Perfil de Cliente Ideal). Usado pela IA para classificar leads. |
| **Kanban** | O formato de visualização do Pipeline, com colunas e cards. |
| **Lead** | Um contato que demonstrou algum nível de interesse, mas ainda não é uma oportunidade qualificada. |
| **Multi-tenant** | Arquitetura que permite que múltiplas empresas (BLUE, TOKENIZA) usem o mesmo sistema de forma isolada. |
| **NPS** | Net Promoter Score. Uma pesquisa de satisfação que mede a lealdade do cliente. |
| **Pipeline** | O funil de vendas, que mostra todos os deals organizados por etapa. |
| **Playbook** | Uma automação do módulo de CS, acionada para resolver ou prevenir problemas com clientes. |
| **RBAC** | Role-Based Access Control. O sistema de permissões baseado no perfil do usuário. |
| **SDR** | Sales Development Representative. O pré-vendedor responsável por qualificar leads. A Amélia SDR é a versão digital. |
| **SLA** | Service Level Agreement. No CRM, refere-se ao tempo máximo que um deal pode ficar em uma etapa. |
| **Supabase** | A plataforma de tecnologia que serve como backend para o Amélia CRM. |
| **Takeover** | O ato de um usuário humano assumir uma conversa que estava sendo conduzida pela Amélia. |

---

## 9. Troubleshooting Básico

Encontrou um problema? Aqui estão os passos iniciais para resolvê-lo.

| Problema Comum | Primeira Ação a Tomar |
| :--- | :--- |
| **Tela branca ou não carrega** | 1. Recarregue a página (`F5` ou `Ctrl+R`). 2. Limpe o cache do seu navegador. 3. Tente acessar em uma janela anônima. |
| **Erro ao salvar um deal/contato** | Verifique se todos os campos marcados como obrigatórios (*) estão preenchidos. Recarregue a página e tente novamente. |
| **Mensagem de WhatsApp não enviada** | Verifique a tela de **Saúde Operacional** (acessível por Admins) para ver se a integração com o WhatsApp está online. Se estiver offline, o sistema já notificou os administradores. |
| **Um deal "sumiu" do Pipeline** | Use a **Busca Global (`Ctrl+K`)** para procurar pelo nome do deal. Ele pode ter sido movido para uma etapa de "Ganho" ou "Perdido", que não são exibidas na visão padrão. |

> Se o problema persistir após essas verificações, entre em contato com o administrador do sistema, fornecendo uma captura de tela e uma descrição do que você estava fazendo quando o erro ocorreu.

---

*Amélia CRM — Manual Geral — Versão 1.0 — Fevereiro de 2026*
