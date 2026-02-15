# BLUE CRM — MANUAL DO SUCESSO DO CLIENTE

**Guia completo para CSMs — monitorar, prevenir e encantar**

Para: Customer Success Managers (CSMs — responsáveis por cuidar de clientes que já compraram)  
Versão 6.1 — Fevereiro 2026

---

## Índice

1. [Seu Papel no Blue CRM](#1-seu-papel-no-blue-crm)
2. [Dashboard CS — Sua Visão do Dia](#2-dashboard-cs--sua-visão-do-dia)
3. [Clientes CS — Seu Portfolio Detalhado](#3-clientes-cs--seu-portfolio-detalhado)
4. [Cadastrar Novo Cliente CS](#4-cadastrar-novo-cliente-cs)
5. [Health Score — Como o Sistema Calcula](#5-health-score--como-o-sistema-calcula)
6. [Predição de Churn — Risco de Cancelamento](#6-predição-de-churn--risco-de-cancelamento)
7. [Pesquisas NPS e CSAT](#7-pesquisas-nps-e-csat)
8. [Incidências — Detectar e Resolver Problemas](#8-incidências--detectar-e-resolver-problemas)
9. [Playbooks — Automação de CS](#9-playbooks--automação-de-cs)
10. [Briefing Diário Automático](#10-briefing-diário-automático)
11. [Tópicos em Alta (Trending Topics)](#11-tópicos-em-alta-trending-topics)
12. [Previsão de Receita (MRR Projetado)](#12-previsão-de-receita-mrr-projetado)
13. [Renovações](#13-renovações)
14. [Copilot para CS](#14-copilot-para-cs)
15. [Seu Dia a Dia como CSM — Rotina Sugerida](#15-seu-dia-a-dia-como-csm--rotina-sugerida)
16. [Uso no Celular](#16-uso-no-celular)
17. [E Se Der Errado? (Troubleshooting)](#17-e-se-der-errado-troubleshooting)

---

## 1. Seu Papel no Blue CRM

Como CSM, você cuida de clientes que **já compraram**. Seu objetivo é garantir que eles estejam satisfeitos, renovem contratos e não cancelem (churn = cancelamento). O Blue CRM automatiza grande parte desse trabalho com IA — mas **você** é quem toma as decisões importantes.

### Módulo de Sucesso do Cliente

| Tela | O Que Você Faz Lá |
|------|-------------------|
| **Dashboard CS** | Visão geral rápida: quantos clientes, MRR (receita mensal recorrente) total, NPS (pesquisa de satisfação 0-10) médio, quantos em risco |
| **Clientes CS** | Lista detalhada de cada cliente com health score (nota de saúde 0-100), risco de churn (cancelamento), MRR, status |
| **Pesquisas** | Histórico de NPS e CSAT (pesquisa de satisfação 1-5) enviados/respondidos |
| **Incidências** | Problemas detectados automaticamente ou reportados manualmente |
| **Playbooks** | Roteiros automáticos que o sistema executa para prevenir problemas |

---

## 2. Dashboard CS — Sua Visão do Dia

> **O que é:** Sua tela de resumo com métricas consolidadas do portfolio de clientes.
> **Como chegar:** Menu lateral → Sucesso do Cliente → **Dashboard CS**.
> **O que você vai ver:** Cards com números no topo e gráficos de evolução abaixo.

### Métricas Principais

| Métrica | O Que É | Por Que Importa |
|---------|---------|-----------------|
| Total de Clientes | Quantidade de clientes ativos | Seu portfolio |
| MRR Total | Soma da receita mensal recorrente | Quanto R$ você protege |
| NPS Médio | Média das pesquisas NPS respondidas | Saúde geral do portfolio |
| Clientes em Risco | Quantos têm risco de churn > 50% | Sua lista de prioridade |
| Health Score Médio | Média dos health scores (0-100) | Tendência geral |

O dashboard também mostra gráficos de evolução do health score e NPS ao longo do tempo.

💡 **Dica:** Acesse o dashboard todo dia de manhã. Se o número de "Clientes em Risco" subir, investigue imediatamente.

---

## 3. Clientes CS — Seu Portfolio Detalhado

> **O que é:** Lista de todos os seus clientes com indicadores de saúde e dados financeiros.
> **Como chegar:** Menu lateral → Sucesso do Cliente → **Clientes CS**.
> **O que você vai ver:** Uma tabela com colunas de dados para cada cliente, e um botão "Novo Cliente" no canto superior direito.

### Entendendo a Tabela

| Coluna | O Que Significa | Como Interpretar |
|--------|----------------|-----------------|
| Empresa | Nome do cliente | — |
| Health Score | 0-100 calculado por IA | 0-40 = Crítico 🔴, 41-70 = Atenção 🟡, 71-100 = Saudável 🟢 |
| Risco Churn | Probabilidade de cancelamento (%) | > 50% = ação urgente |
| NPS | Último NPS respondido (0-10) | 0-6 = Detrator, 7-8 = Neutro, 9-10 = Promotor |
| MRR | Receita mensal deste cliente | Priorize clientes de maior MRR em risco |
| Status | Ativo, Em risco, Churned | Em risco = precisa de atenção |
| Última Interação | Data do último contato | Se > 30 dias, faça contato |

### Abrindo o Detalhe de um Cliente

1. Clique no **nome do cliente** na lista
2. Abre a página de detalhe com TUDO sobre este cliente

Na página de detalhe você encontra:

- **Health Score com Explicação IA:** A Amélia explica em linguagem simples por que o health score mudou. Exemplo: *"Health caiu de 75 para 45 porque NPS ficou em 4/10 e não houve interação nos últimos 25 dias."*
- **Risco de Churn:** Porcentagem com gráfico de evolução
- **MRR e Contrato:** Valor, data de renovação, termos
- **Pesquisas:** Histórico de NPS/CSAT com notas e comentários
- **Incidências:** Problemas abertos e resolvidos
- **Notas do CSM:** Suas anotações sobre o cliente
- **Timeline:** Histórico completo de interações

### Notas Sugeridas pela IA

Na página de detalhe do cliente, há um botão **"Sugerir Nota com IA"**. Quando você clica:

1. A Amélia analisa: pesquisas recentes, incidências, health score, última interação
2. Gera uma sugestão de nota. Exemplo: *"NPS caiu para 4. Duas incidências abertas (latência e suporte lento). Recomendar reunião de alinhamento com time técnico."*
3. Você revisa, edita se necessário, e salva

💡 **Dica:** Use as notas sugeridas como ponto de partida. A IA condensa informações que levariam 15 minutos para você revisar manualmente.

---

## 4. Cadastrar Novo Cliente CS

> **O que é:** Funcionalidade para registrar manualmente um novo cliente no módulo de Sucesso do Cliente.
> **Como chegar:** Menu lateral → Sucesso do Cliente → Clientes CS → botão **"Novo Cliente"** no canto superior direito.
> **O que você vai ver:** Um formulário (janela pop-up) com campos para preencher os dados do novo cliente.

**Passo a passo:**

1. Vá em **Sucesso do Cliente → Clientes CS**
2. Clique no botão **"Novo Cliente"** no canto superior direito da tela
3. No formulário que abre, preencha:
   - **Contato** (obrigatório): Selecione um contato existente no sistema. Use o campo de busca para encontrar pelo nome
   - **Empresa**: Já vem preenchido com a empresa ativa (BLUE ou TOKENIZA)
   - **MRR**: Valor da receita mensal recorrente deste cliente (em R$)
   - **Data da próxima renovação**: Quando o contrato vence
   - **Notas**: Observações iniciais sobre o cliente
4. Clique em **"Criar"**
5. O sistema cria o cliente com health score inicial de **50** (Atenção) e risco de churn **0%**
6. Você é redirecionado para a página de detalhe do novo cliente

⚠️ **Atenção:** O contato precisa existir no sistema antes de criar o cliente CS. Se o contato ainda não foi cadastrado, vá em Contatos → + Novo primeiro.

💡 **Dica:** Após cadastrar, o health score será recalculado automaticamente no dia seguinte (às 6h da manhã) com base nos dados reais do cliente.

---

## 5. Health Score — Como o Sistema Calcula

> **O que é:** Uma nota de 0 a 100 que representa a saúde de cada cliente. É recalculada automaticamente todo dia às 6h da manhã.
> **Como chegar:** Visível na lista de Clientes CS e no detalhe de cada cliente.
> **O que você vai ver:** Um número colorido (verde/amarelo/vermelho) com explicação da IA abaixo.

### Fatores do Cálculo

| Fator | Peso | O Que Mede |
|-------|------|-----------|
| NPS | 30% | Última pesquisa NPS respondida |
| Engajamento | 25% | Frequência de interações nos últimos 30 dias |
| Incidências | 20% | Incidências abertas e gravidade |
| Tempo desde último contato | 15% | Dias desde a última interação |
| Valor de renovação | 10% | Proximidade e valor da renovação |

Quando o health score muda significativamente (mais de 15 pontos), a IA gera uma **explicação narrativa** automaticamente. Você vê essa explicação no detalhe do cliente. Exemplo: *"Health caiu de 82 para 55. Motivo principal: NPS detrator (nota 3) recebido ontem + nenhuma interação nos últimos 22 dias."*

⚠️ **Atenção:** Health score **0** significa que o cálculo **ainda não rodou** para este cliente. NÃO significa que o cliente está em crise.

---

## 6. Predição de Churn — Risco de Cancelamento

> **O que é:** A IA calcula a probabilidade de cada cliente cancelar o serviço nos próximos 90 dias.
> **Como chegar:** Visível na lista de Clientes CS (coluna "Risco Churn") e no detalhe do cliente.
> **O que você vai ver:** Uma porcentagem com indicador visual (verde/amarelo/vermelho).

O preditor de churn roda **todo dia às 7h** e analisa:

- Tendência do health score (caindo? estável? subindo?)
- Respostas de NPS (detratores têm maior risco)
- Frequência de contato (clientes silenciosos = risco)
- Incidências abertas e não resolvidas
- Proximidade da renovação com health baixo

### Como interpretar:

| Risco | Significado | Ação |
|-------|-------------|------|
| 0-25% | Baixo | Monitorar normalmente |
| 26-50% | Moderado | Agendar touchpoint (ponto de contato) |
| 51-75% | Alto | Ação imediata — ligar para o cliente |
| 76-100% | Crítico | Reunião de emergência — escalar para gestor |

💡 **Dica:** Não espere o risco chegar em 75% para agir. Quando subir acima de 50%, já faça contato proativo com o cliente.

---

## 7. Pesquisas NPS e CSAT

> **O que é:** Pesquisas de satisfação enviadas aos clientes para medir como eles avaliam o serviço.
> **Como chegar:** Menu lateral → Sucesso do Cliente → **Pesquisas**.
> **O que você vai ver:** Lista de pesquisas enviadas e respondidas, com datas e notas.

### 7.1 Pesquisas Automáticas

O sistema envia pesquisas NPS automaticamente **todo dia às 9h** para clientes elegíveis (que não receberam pesquisa nos últimos 30 dias). Você não precisa fazer nada — é automático.

**O que o cliente recebe:** Uma mensagem via WhatsApp com um link. Ao clicar, ele vê uma pergunta simples: "De 0 a 10, quanto você recomendaria nosso serviço?" com botões numéricos para responder.

### 7.2 Pesquisas Manuais

1. Menu lateral → Sucesso do Cliente → **Pesquisas**
2. Clique em **"Nova Pesquisa"**
3. Selecione o tipo: **NPS** (0-10) ou **CSAT** (1-5)
4. Selecione os clientes destinatários
5. Confirme o envio

### 7.3 Pesquisa em Massa

1. Menu lateral → Sucesso do Cliente → Pesquisas → botão **"Enviar em Massa"**
2. Filtre clientes por health score, NPS anterior, ou status
3. Selecione todos ou escolha específicos
4. Escolha o tipo de pesquisa (NPS ou CSAT)
5. Confirme o envio

💡 **Dica:** Envie pesquisas CSAT após resolver incidências. É o melhor momento para medir satisfação com o suporte.

---

## 8. Incidências — Detectar e Resolver Problemas

> **O que é:** Registro de problemas que afetam clientes, detectados automaticamente pela IA ou registrados manualmente.
> **Como chegar:** Menu lateral → Sucesso do Cliente → **Incidências**.
> **O que você vai ver:** Lista de problemas ordenados por gravidade (Crítica, Alta, Média, Baixa).

### 8.1 Detecção Automática

O sistema analisa dados dos clientes **a cada 2 horas** e detecta incidências automaticamente:
- NPS caiu abaixo de 6
- Health score caiu mais de 20 pontos em 7 dias
- Cliente não interage há mais de 30 dias
- Renovação em menos de 30 dias com health score baixo

### 8.2 Gerenciando Incidências

1. Menu lateral → Sucesso do Cliente → **Incidências**
2. Veja a lista ordenada por gravidade: **Crítica**, Alta, Média, Baixa
3. Clique em uma incidência para ver detalhes
4. Mude o status: **Aberta** → **Em Andamento** → **Resolvida**
5. Adicione notas sobre as ações tomadas

### 8.3 Criando Incidência Manual

1. Na lista de incidências, clique em **"+ Nova Incidência"**
2. Selecione o cliente
3. Defina: título, descrição, gravidade (Crítica/Alta/Média/Baixa)
4. Salve

⚠️ **Atenção:** Incidências **CRÍTICAS** devem ser tratadas **no mesmo dia**. Elas impactam diretamente o health score do cliente.

---

## 9. Playbooks — Automação de CS

> **O que é:** Roteiros automáticos que o sistema executa quando certas condições são detectadas. Funcionam como "planos de ação" automáticos.
> **Como chegar:** Menu lateral → Sucesso do Cliente → **Playbooks**.
> **O que você vai ver:** Lista de playbooks com nome, gatilho (o que dispara), clientes afetados e status.

### Exemplo: Playbook "Recuperação NPS Baixo"

**Gatilho:** NPS respondido com nota 0-6 (detrator)

| Dia | Ação Automática |
|-----|----------------|
| Dia 0 | Criar incidência + notificar CSM (você recebe no sininho 🔔) |
| Dia 1 | Enviar email ao cliente pedindo feedback qualitativo |
| Dia 3 | Agendar tarefa para CSM: ligar para o cliente |
| Dia 7 | Se NPS não melhorou: escalar para gestor |

### Playbooks e Renovações

⚠️ **Informação importante:** Alguns playbooks criam **deals de renovação automaticamente** quando detectam que um contrato está próximo do vencimento. Esses deals aparecem no Pipeline e podem ser acompanhados como qualquer outro deal.

### Gerenciando Playbooks

1. Menu lateral → Sucesso do Cliente → **Playbooks**
2. Veja playbooks ativos e seus status
3. Cada playbook mostra: nome, gatilho, clientes afetados, em qual passo está

Os playbooks rodam automaticamente **a cada 30 minutos**.

💡 **Dica:** Playbooks são criados pelo administrador. Se precisar de um novo playbook, descreva a situação e as ações desejadas para o admin.

---

## 10. Briefing Diário Automático

> **O que é:** Um resumo gerado automaticamente pela IA todo dia às 8:30, com tudo que você precisa saber sobre seus clientes.
> **Como chegar:** Abra o **Copilot** (ícone da Amélia no topo da tela). O briefing aparece como primeiro card.
> **O que você vai ver:** Um card com texto resumindo a situação dos seus clientes.

### O que o briefing contém:

- **Clientes que pioraram:** Quais tiveram queda no health score nas últimas 24h
- **Pesquisas respondidas:** Quais clientes responderam NPS/CSAT ontem e com que nota
- **Incidências abertas:** Quantas incidências abertas e quais são críticas
- **Renovações próximas:** Contratos que vencem nos próximos 30 dias
- **Ações sugeridas:** O que a IA recomenda que você faça hoje

💡 **Dica:** Leia o briefing todo dia às 8:30 como primeira atividade. Ele resume em 30 segundos o que levaria 15 minutos para pesquisar manualmente.

---

## 11. Tópicos em Alta (Trending Topics)

> **O que é:** A IA analisa todas as interações com clientes e identifica os assuntos mais mencionados recentemente.
> **Como chegar:** Dashboard CS → seção "Tópicos em Alta" (na parte inferior da tela).
> **O que você vai ver:** Uma lista de tópicos com frequência de menção e tendência (subindo/descendo).

### Como interpretar:

- **Tópico subindo** 📈: Mais clientes estão falando sobre isso. Pode ser um problema emergente (ex: "lentidão") ou oportunidade (ex: "nova funcionalidade")
- **Tópico descendo** 📉: O assunto está se resolvendo ou perdendo relevância
- **Tópico novo** 🆕: Algo que não aparecia antes e começou a surgir

💡 **Dica:** Se um tópico negativo (como "erro", "lento", "problema") estiver subindo, investigue imediatamente. Pode indicar um problema técnico afetando vários clientes ao mesmo tempo.

---

## 12. Previsão de Receita (MRR Projetado)

> **O que é:** A IA calcula quanto de receita mensal recorrente (MRR) você deve ter nos próximos meses, considerando renovações, churn previsto e expansões.
> **Como chegar:** Dashboard CS → card "Receita Projetada".
> **O que você vai ver:** Gráfico com a receita atual e projeção para os próximos meses.

O cálculo leva em conta:
- MRR atual de todos os clientes ativos
- Risco de churn de cada cliente (clientes com alto risco podem sair)
- Renovações previstas (clientes que devem renovar)
- Tendência do health score (portfólio melhorando ou piorando?)

A previsão é recalculada **todo dia às 6h** automaticamente.

💡 **Dica:** A previsão melhora com mais dados históricos. Após 3 meses de uso, ela se torna bem precisa.

---

## 13. Renovações

> **O que é:** Tela que mostra todos os contratos com data de renovação próxima.
> **Como chegar:** Menu lateral → Comercial → **Renovação**.
> **O que você vai ver:** Lista de renovações com cliente, valor, data de vencimento e health score.

Cada renovação mostra: cliente, valor do contrato, data de vencimento e health score.

### Como funcionam as renovações automáticas:

O sistema (via Playbooks) pode **criar deals de renovação automaticamente** quando um contrato está próximo do vencimento. Esses deals aparecem no Pipeline com o tag "Renovação" e podem ser acompanhados como qualquer outro deal.

O sistema envia **alertas automáticos** de renovação todo dia às 8h. Se um cliente com renovação próxima tem health score baixo, trate a incidência **ANTES** de falar de renovação.

⚠️ **Atenção:** Nunca tente renovar um contrato de um cliente insatisfeito. Resolva os problemas primeiro (incidências, NPS baixo) e depois aborde a renovação.

---

## 14. Copilot para CS

> **O que é:** A Amélia é especialista em CS também. Pode responder perguntas sobre seus clientes, sugerir ações e gerar resumos.
> **Como chegar:** Clique no ícone da Amélia no topo da tela (ao lado do sininho 🔔).
> **O que você vai ver:** Painel de chat à direita da tela.

### Exemplos do que perguntar:

- *"Quais clientes têm maior risco de churn esta semana?"*
- *"Por que o health score da empresa X caiu?"*
- *"Sugira uma nota para a reunião com o cliente Y"*
- *"Quais pesquisas NPS foram respondidas hoje?"*
- *"Resuma as incidências abertas do meu portfolio"*

💡 **Dica:** Se abrir o Copilot **de dentro da página de detalhe de um cliente**, a Amélia já sabe qual cliente é. Não precisa repetir o nome.

---

## 15. Seu Dia a Dia como CSM — Rotina Sugerida

| Horário | Ação | Onde |
|---------|------|------|
| 08:00 | Ver Dashboard CS — algum cliente novo em risco? | Dashboard CS |
| 08:15 | Checar incidências do dia — resolver **CRÍTICAS** | Incidências |
| 08:30 | Ler **briefing diário** (gerado pela IA automaticamente) | Copilot (ícone da Amélia no topo) |
| 09:00 | Revisar **respostas** de pesquisas NPS que clientes enviaram | Pesquisas |
| 10:00 | Ligações de acompanhamento para clientes em risco | Clientes CS |
| 14:00 | Atualizar notas dos clientes que contatou | Detalhe do Cliente |
| 16:00 | Verificar playbooks em andamento | Playbooks |
| 17:00 | Revisar health scores que mudaram | Clientes CS |

💡 **Dica:** O briefing diário é gerado automaticamente todo dia às 8:30 pela IA. Ele resume: clientes que pioraram, pesquisas respondidas ontem, incidências abertas, renovações próximas.

---

## 16. Uso no Celular

O Blue CRM funciona no celular pelo navegador (Chrome recomendado). Diferenças no celular:

- O **menu lateral** vira um **menu hambúrguer** (☰) no canto superior esquerdo
- As tabelas de clientes rolam horizontalmente — deslize para os lados
- O painel de detalhe do cliente abre em **tela cheia**
- O Copilot funciona normalmente pelo ícone no topo

💡 **Dica:** No celular, use a **Busca Global** (ícone de lupa) para navegar mais rápido em vez de usar o menu.

---

## 17. E Se Der Errado? (Troubleshooting)

| Problema | O Que Fazer |
|----------|-------------|
| **Health score mostra 0** | Isso significa que o cálculo **ainda não rodou** para este cliente. Aguarde até as 6h do dia seguinte |
| **Pesquisa NPS não foi enviada** | Verifique se o cliente tem telefone cadastrado com WhatsApp. Verifique no sininho se há alerta de integração WhatsApp |
| **Cliente não aparece na lista** | Verifique se o cliente está cadastrado na empresa correta (BLUE ou TOKENIZA). Use a busca no topo da tabela |
| **Incidência foi criada por engano** | Mude o status para "Resolvida" e adicione uma nota explicando. Não é possível deletar incidências |
| **Briefing diário não apareceu** | Ele é gerado às 8:30. Se são 9h e não apareceu, abra o Copilot e pergunte "Qual é o briefing de hoje?" |

❓ **Se nada funcionar:** Recarregue a página (F5), saia e entre novamente, ou limpe o cache do navegador. Se persistir, entre em contato com o administrador.

---

*Blue CRM — Manual do Sucesso do Cliente — Versão 6.1 — Fevereiro 2026*
