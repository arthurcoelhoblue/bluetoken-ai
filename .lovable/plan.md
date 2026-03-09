

# Plano: Corrigir templates falhando e reenviar batch

## Status Atual
- **18 templates Axia**: todos `PENDING` (já submetidos, aguardando aprovação Meta) ✅
- **5 templates MPUPPE**: submetidos com sucesso e atualizados para `PENDING` ✅  
- **2 templates MPUPPE falhando**: `lgpd_followup_conteudo` e `lgpd_risco_anpd_urgencia` — Meta rejeita com "Variáveis não podem estar no início ou no fim do modelo"
- **19 templates MPUPPE restantes**: ainda `LOCAL`, não foram processados pois o batch expirou antes de completar
- **Sync PATCH**: 17 templates sincronizados com sucesso ✅

## Causa Raiz dos 2 Erros
A normalização do edge function adiciona `.` apenas quando o texto termina exatamente com `}}`. Mas os templates armazenados já têm `{{2}}.` (variável + ponto) — a Meta ainda considera isso "variável no final".

## Etapas

### 1. Melhorar normalização no edge function
Alterar o regex de detecção de variável final para também capturar `{{N}}.` ou `{{N}}!` (variável + pontuação simples):
- De: `/\{\{[^}]+\}\}\s*$/`
- Para: `/\{\{[^}]+\}\}\s*[.!?,;:]?\s*$/`
- Quando detectado, substituir por `{{N}}. Fico à disposição.`

### 2. Reenviar batch-submit
Com a normalização corrigida, disparar novamente o batch para submeter os 21 templates LOCAL restantes (incluindo os 2 que falharam).

### 3. Sincronizar status
Rodar PATCH novamente para atualizar status dos que já foram aprovados/rejeitados pela Meta.

