# Corrigir Alucinação do Processo de Investimento Tokeniza

## Problema

A Amélia está inventando um fluxo falso de investimento: pede CPF, promete gerar contratos, promete enviar dados bancários para transferência. Na realidade, **investimentos na Tokeniza são feitos exclusivamente pela plataforma** (plataforma.tokeniza.com.br). A IA não tem nenhuma instrução sobre isso.

## Causa Raiz

O prompt tem "PROIBIDO INVENTAR" para preços/produtos, mas **não tem nenhuma regra sobre o processo de investimento**. Quando o lead diz "quero investir", a IA improvisa um fluxo inteiro que não existe.

## Alterações

### 1. `supabase/functions/sdr-ia-interpret/intent-classifier.ts`

- Adicionar ao `TOKENIZA_KNOWLEDGE` uma seção `processoInvestimento` com as regras:
  - Investimentos são feitos **exclusivamente pela plataforma** (app.tokeniza.com.br)
  - A Amélia NÃO gera contratos, NÃO coleta CPF, NÃO envia dados bancários
  - Fluxo correto: cadastro na plataforma → escolher oferta → investir pela plataforma
- Injetar no `SYSTEM_PROMPT` e `PASSIVE_CHAT_PROMPT` uma regra específica para Tokeniza:
  ```
  ## 🚫 PROCESSO TOKENIZA — REGRA CRÍTICA
  Investimentos são feitos EXCLUSIVAMENTE pela plataforma plataforma.tokeniza.com.br.
  PROIBIDO: gerar contratos, pedir CPF/documentos, prometer envio de dados bancários, simular processo de fechamento fora da plataforma.
  Quando o lead quiser investir: direcione-o para a plataforma com o link e ofereça ajuda para dúvidas.
  ```
- Adicionar **regra rule-based** para DECISAO_TOMADA quando empresa = TOKENIZA: em vez de escalar, responder direcionando para a plataforma

### 2. `supabase/functions/sdr-ia-interpret/response-generator.ts`

- Adicionar no `systemPrompt` default (quando empresa = TOKENIZA) a mesma regra crítica sobre processo exclusivo via plataforma
- Garantir que o prompt de geração inclua instrução: "Se o lead quer investir, direcione para app.tokeniza.com.br. NUNCA simule um processo de fechamento."

### Fluxo corrigido

```text
Lead: "Quero investir 10k"
    │
    ├── ANTES (alucinação): "Me manda CPF e email, vou gerar contrato..."
    │
    └── DEPOIS: "Para investir, acesse app.tokeniza.com.br, 
                 crie sua conta e escolha a oferta. Posso te ajudar
                 com dúvidas sobre as ofertas disponíveis!"
```