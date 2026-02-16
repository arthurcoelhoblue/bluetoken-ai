---
sidebar_position: 1
slug: /intro
title: Visão Geral do Amélia CRM
---

# O Que é o Amélia CRM?

O **Amélia CRM** é uma plataforma de gestão de relacionamento com o cliente projetada para otimizar e automatizar os processos de vendas e sucesso do cliente (CS). Diferente de CRMs tradicionais, o Amélia incorpora uma assistente de **Inteligência Artificial** que atua como membro proativo da equipe.

:::info O que a Amélia faz por você
A Amélia analisa dados, classifica leads, sugere próximas ações, automatiza comunicação e fornece insights estratégicos — 24 horas por dia, 7 dias por semana.
:::

## Modelo Multi-Tenant: BLUE e TOKENIZA

O sistema opera em modelo **multi-tenant**, gerenciando múltiplas empresas de forma isolada:

| Empresa | Foco de Negócio | No CRM |
|:--|:--|:--|
| **BLUE** | Contabilidade e imposto de renda | Funis, cadências e produtos específicos para BLUE |
| **TOKENIZA** | Tokenização de ativos e investimentos | Funis e produtos voltados para investimentos |

:::warning Atenção ao contexto
Verifique sempre se você está trabalhando no contexto da empresa correta ao usar filtros e seletores.
:::

## Arquitetura do Sistema

O Amélia CRM consiste em três camadas:

1. **Frontend** — Interface moderna (React + Vite + TypeScript), rápida e responsiva.
2. **Backend** — Banco de dados PostgreSQL com autenticação e segurança integrados.
3. **Edge Functions (IA)** — Programas que executam classificação, análise e geração de respostas com IA.

## Módulos Principais

| Módulo | Seções | Objetivo |
|:--|:--|:--|
| **Área de Trabalho** | Meu Dia, Pipeline, Contatos, Conversas, Pendências | Operação diária de vendas |
| **Comercial** | Metas, Cockpit, Relatórios, Leads Quentes | Performance e oportunidades |
| **Automação** | Amélia IA, Cadências, Templates, Formulários | Escalar comunicação |
| **Sucesso do Cliente** | Dashboard CS, Clientes, Pesquisas, Playbooks | Retenção de clientes |
| **Configuração** | Funis, Campos, Integrações, Usuários | Administração do sistema |

## Perfis de Acesso (RBAC)

| Perfil | Descrição |
|:--|:--|
| **Vendedor (Closer/SDR)** | Vê apenas seus próprios deals e contatos |
| **CSM** | Acesso total ao módulo de CS |
| **Gestor de Vendas** | Pipeline da equipe + relatórios + Cockpit |
| **Administrador** | Acesso total e irrestrito |
| **Auditor** | Apenas leitura para compliance |

## Glossário Rápido

| Termo | Definição |
|:--|:--|
| **Deal** | Oportunidade de negócio no Pipeline |
| **Cadência** | Sequência automatizada de contatos |
| **Health Score** | Pontuação de saúde do cliente (0-100) |
| **Churn** | Cancelamento de contrato |
| **Takeover** | Humano assume conversa da IA |
| **ICP** | Perfil de Cliente Ideal |
| **SLA** | Tempo máximo de um deal em uma etapa |

---

Escolha seu perfil na barra lateral para acessar a documentação específica da sua função.
