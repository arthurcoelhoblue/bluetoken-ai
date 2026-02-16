># Amélia CRM — Manual do Gestor e Administrador

**Versão 1.0 — Configuração, Monitoramento e Estratégia com IA**

- **Para**: Administradores, Diretores e Gestores de Vendas/CS.
- **Autor**: Manus AI
- **Data**: 15 de Fevereiro de 2026

---

## Introdução: O Gestor como Arquiteto do Sistema

Como Gestor ou Administrador no Amélia CRM, seu papel transcende a supervisão. Você é o arquiteto do sistema, responsável por configurar os processos, monitorar a performance, gerenciar os custos e garantir que a plataforma esteja perfeitamente alinhada com os objetivos estratégicos da empresa.

Este manual é seu guia técnico e estratégico. Ele cobre as funcionalidades exclusivas do seu perfil, capacitando-o a tomar decisões baseadas em dados, otimizar a operação e extrair o máximo valor da Inteligência Artificial da Amélia.

> Sua missão é transformar dados em estratégia e estratégia em resultados. A Amélia CRM fornece as ferramentas para que você faça isso com precisão e agilidade.

---

## Índice

1.  [Dashboards Estratégicos: Visão 360° do Negócio](#1-dashboards-estratégicos-visão-360-do-negócio)
    -   [Cockpit: O Pulso das Vendas](#11-cockpit-o-pulso-das-vendas)
    -   [Relatórios e Analytics Executivo](#12-relatórios-e-analytics-executivo)
2.  [Configuração do Sistema: Moldando o CRM](#2-configuração-do-sistema-moldando-o-crm)
    -   [Gestão de Funis (Pipelines)](#21-gestão-de-funis-pipelines)
    -   [Campos Customizados](#22-campos-customizados)
    -   [Gestão de Usuários e Perfis de Acesso](#23-gestão-de-usuários-e-perfis-de-acesso)
    -   [Templates e Regras Automáticas](#24-templates-e-regras-automáticas)
3.  [Gestão da Inteligência Artificial](#3-gestão-da-inteligência-artificial)
    -   [Base de Conhecimento: Treinando a Amélia](#31-base-de-conhecimento-treinando-a-amélia)
    -   [Monitoramento de Custos de IA](#32-monitoramento-de-custos-de-ia)
    -   [Benchmark de IA: Otimizando a Performance](#33-benchmark-de-ia)
    -   [Configurações da Amélia SDR](#34-configurações-da-amélia-sdr)
4.  [Operações e Dados](#4-operações-e-dados)
    -   [Saúde Operacional: Monitorando Integrações](#41-saúde-operacional-monitorando-integrações)
    -   [Importação de Dados](#42-importação-de-dados)
    -   [Webhooks e Integrações Externas](#43-webhooks-e-integrações-externas)
    -   [CRON Jobs: O Motor por Trás da Automação](#44-cron-jobs-o-motor-por-trás-da-automação)
5.  [Gestão de Equipe: Análise de Performance](#5-gestão-de-equipe-análise-de-performance)
6.  [FAQ do Gestor](#6-faq-do-gestor)

---

## 1. Dashboards Estratégicos: Visão 360° do Negócio

### 1.1. Cockpit: O Pulso das Vendas

O **Cockpit** é sua central de comando para a operação de vendas, consolidando os indicadores mais importantes em uma única tela.

-   **Como chegar**: Menu → Comercial → **Cockpit**.
-   **O que você vê**: Uma visão completa do funil, performance da equipe e velocidade das vendas.

`[IMAGEM: Tela do Cockpit, com gráficos de funil, conversão e performance por vendedor.]`

**Análises Chave:**
-   **Visão do Funil**: Acompanhe o valor (R$) e a quantidade de deals em cada etapa.
-   **Performance por Vendedor**: Compare o desempenho individual em termos de deals ganhos, pipeline gerado e atividades realizadas.
-   **Velocidade do Funil**: Identifique gargalos analisando o tempo médio que os deals levam para passar de uma etapa para outra.
-   **Taxa de Conversão**: Entenda a eficiência do seu processo de vendas, etapa por etapa.

### 1.2. Relatórios e Analytics Executivo

Enquanto o Cockpit mostra o "o quê", o **Analytics Executivo** mostra o "porquê". Esta é a área onde a IA fornece insights mais profundos.

-   **Como chegar**: Menu → Comercial → Relatórios → Aba "Executivo".

**Insights Preditivos e Analíticos:**
-   **Previsão de Receita (Revenue Forecast)**: A Amélia projeta a receita futura com base no pipeline atual, taxas de conversão históricas e sazonalidade. A precisão aumenta significativamente após 3 meses de dados.
-   **Análise de Perda (Loss Analysis)**: A IA analisa todos os deals perdidos e identifica os motivos mais comuns, padrões de objeção e perfis de clientes que mais desistem.
-   **Insights de ICP (Ideal Customer Profile)**: Descubra as características dos clientes que mais compram, permitindo que você refine sua estratégia de marketing e vendas.
-   **Relatório Semanal Automático**: Todo domingo, a IA compila um resumo da semana e o entrega como uma notificação, destacando vitórias, perdas e pontos de atenção.

---

## 2. Configuração do Sistema: Moldando o CRM

### 2.1. Gestão de Funis (Pipelines)

Aqui você desenha o processo de vendas da sua empresa.

-   **Como chegar**: Menu → Configuração → **Funis**.

**Ações Principais:**
-   **Criar/Editar Etapas**: Defina o nome de cada etapa, a cor, e o **SLA** (tempo máximo em dias que um deal pode ficar nela). Etapas com SLA estourado são destacadas em vermelho no pipeline do vendedor.
-   **Múltiplos Funis**: Crie funis diferentes para processos de venda distintos (ex: "Vendas Inbound" vs. "Vendas Enterprise").

### 2.2. Campos Customizados

Adapte o CRM às necessidades de dados da sua empresa.

-   **Como chegar**: Menu → Configuração → **Campos**.
-   **O que fazer**: Crie campos adicionais para Deals, Contatos ou Organizações. Você pode definir o tipo de campo (texto, número, data, lista de seleção) e se ele é obrigatório.

### 2.3. Gestão de Usuários e Perfis de Acesso

-   **Como chegar**: Menu → Configuração → **Usuários**.
-   **Ações**: Convide novos usuários, desative contas e atribua perfis de acesso (Roles). Consulte a tabela de permissões no Manual Geral para entender o que cada perfil pode fazer.

### 2.4. Templates e Regras Automáticas

-   **Templates de Mensagem**: Crie modelos de e-mail e WhatsApp para garantir consistência na comunicação da equipe.
-   **Regras Automáticas do Pipeline**: Crie automações baseadas em gatilhos. Ex: *"Quando um deal entrar na etapa 'Proposta', criar uma tarefa para o vendedor fazer follow-up em 3 dias."*

---

## 3. Gestão da Inteligência Artificial

### 3.1. Base de Conhecimento: Treinando a Amélia

Esta é a área onde você ensina a Amélia sobre seus produtos e serviços.

-   **Como chegar**: Menu → Configuração → **Base de Conhecimento**.
-   **O que fazer**: Cadastre seus produtos com descrições, preços, benefícios e um FAQ detalhado. A Amélia usará essas informações para responder a perguntas de leads de forma autônoma.

> **Atenção**: Mantenha esta base **rigorosamente atualizada**. Informações desatualizadas aqui levarão a IA a dar respostas incorretas aos clientes.

### 3.2. Monitoramento de Custos de IA

-   **Como chegar**: Menu → Configuração → **Custos IA**.
-   **Análise**: Monitore os gastos com IA, detalhados por função (ex: `copilot-chat`, `deal-scoring`) e por modelo de IA. Use a aba **Adoção** para ver quais funcionalidades estão sendo mais usadas pela equipe.

> O sistema possui proteções automáticas (rate limiting) para evitar picos de custo, mas o monitoramento semanal é recomendado para identificar anomalias.

### 3.3. Benchmark de IA

-   **Como chegar**: Menu → Configuração → **Benchmark IA**.
-   **O que é**: Uma ferramenta para testar diferentes modelos de IA (ex: Claude, Gemini, GPT-4o) em cenários reais do seu negócio. Use-a para encontrar o equilíbrio ideal entre custo e qualidade para cada tarefa.

### 3.4. Configurações da Amélia SDR

-   **Como chegar**: Menu → Configuração → **Configurações IA**.
-   **Ações**: Defina o comportamento da pré-vendedora digital. Configure em quais situações ela deve responder automaticamente, quando deve escalar para um humano e qual o tom de voz a ser utilizado.

---

## 4. Operações e Dados

### 4.1. Saúde Operacional: Monitorando Integrações

-   **Como chegar**: Menu → Configuração → **Saúde Operacional**.
-   **O que é**: Um painel que monitora o status de todas as integrações críticas (Banco de Dados, APIs de IA, WhatsApp, E-mail, Telefonia) em tempo real. Se uma integração falhar repetidamente, os administradores são notificados automaticamente.

### 4.2. Importação de Dados

-   **Como chegar**: Menu → Configuração → **Importação**.
-   **Como usar**: Siga o passo a passo para importar listas de contatos, empresas ou deals a partir de arquivos CSV. O sistema oferece um mapeamento de colunas para garantir que os dados sejam importados corretamente.

### 4.3. Webhooks e Integrações Externas

-   **Como chegar**: Menu → Configuração → **Integrações**.
-   **O que fazer**: Configure webhooks para enviar ou receber dados de sistemas externos, como plataformas de marketing (SGT) ou outros ERPs. A documentação de cada webhook detalha o payload esperado.

### 4.4. CRON Jobs: O Motor por Trás da Automação

CRON Jobs são tarefas agendadas que rodam automaticamente no servidor. É importante que você saiba o que elas fazem:

| Job | Frequência | Descrição |
| :--- | :--- | :--- |
| `cadence-runner` | A cada 15 minutos | Processa os próximos passos das cadências ativas. |
| `cs-health-calculator` | Diariamente às 6h | Recalcula o Health Score de todos os clientes. |
| `cs-churn-predictor` | Diariamente às 7h | Roda o modelo de predição de churn. |
| `cs-daily-briefing` | Diariamente às 8h | Gera o resumo diário para a equipe de CS. |
| `weekly-report` | Domingos às 20h | Compila e gera o relatório semanal de vendas. |

---

## 5. Gestão de Equipe: Análise de Performance

Use os relatórios para ir além dos números de vendas e analisar a eficiência da sua equipe.

-   **Métricas de Atividade**: Em **Relatórios**, analise a quantidade de ligações, e-mails e reuniões por vendedor. Um vendedor com muitas atividades e poucos resultados pode precisar de coaching.
-   **Taxa de Adoção da IA**: Em **Custos IA → Adoção**, veja quais vendedores estão utilizando mais as ferramentas de IA. Baixa adoção pode indicar necessidade de treinamento.
-   **Análise de Pipeline**: No **Cockpit**, compare a taxa de conversão entre os vendedores. Diferenças grandes podem indicar problemas em etapas específicas do processo para alguns membros da equipe.

---

## 6. FAQ do Gestor

-   **P: O custo da IA está subindo. Como posso controlar?**
    -   **R**: Use o **Benchmark de IA** para testar se modelos mais baratos podem realizar algumas tarefas com qualidade aceitável. Verifique também na tela de **Custos IA** se alguma função específica está com uso anormalmente alto, o que pode indicar um erro ou loop.

-   **P: A equipe está reclamando que a IA está dando sugestões ruins. O que fazer?**
    -   **R**: Primeiro, verifique se a **Base de Conhecimento** está completa e atualizada. Segundo, use o **Benchmark de IA** para comparar as respostas do modelo atual com outros. Terceiro, considere refinar os prompts usados pela IA nas configurações.

-   **P: Como garanto a segurança dos dados com múltiplos perfis de acesso?**
    -   **R**: Revise periodicamente os perfis de acesso de cada usuário na tela de **Usuários**. Atribua sempre o perfil com o menor nível de permissão necessário para a função da pessoa (Princípio do Menor Privilégio).

---

*Amélia CRM — Manual do Gestor e Administrador — Versão 1.0 — Fevereiro de 2026*
