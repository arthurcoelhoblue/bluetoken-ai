

# Plano: Criar Templates Reais para Cadências de SDR

## Contexto

As cadências de aquecimento ("Warming Inbound Frio") para Tokeniza e Blue referenciam templates que ainda nao existem no banco (`SAUDACAO_INBOUND`, `FOLLOWUP_INBOUND`, `APRESENTACAO_TOKENIZA`, `APRESENTACAO_BLUE`). Alem disso, a cadencia "Onboarding Blue - E-mail" usa o placeholder `BLUE_EMAIL_TESTE` nos dois steps. Precisamos criar os templates faltantes e os extras de email (Case e Oferta).

O motor de cadencias (`cadence-runner`) resolve templates por `empresa` + `codigo`, entao templates com mesmo codigo mas empresas diferentes funcionam corretamente.

## Templates a Criar (12 no total)

### WhatsApp (4 templates)

| codigo | empresa | canal | conteudo |
|--------|---------|-------|----------|
| `SAUDACAO_INBOUND` | TOKENIZA | WHATSAPP | Texto 1 aprovado (Amelia/Tokeniza) |
| `FOLLOWUP_INBOUND` | TOKENIZA | WHATSAPP | Texto 2 aprovado |
| `SAUDACAO_INBOUND` | BLUE | WHATSAPP | Texto 3 aprovado (Amelia/Blue) |
| `FOLLOWUP_INBOUND` | BLUE | WHATSAPP | Texto 4 aprovado |

### Email (8 templates)

| codigo | empresa | canal | assunto |
|--------|---------|-------|---------|
| `APRESENTACAO_TOKENIZA` | TOKENIZA | EMAIL | Acesse ativos exclusivos... |
| `APRESENTACAO_BLUE` | BLUE | EMAIL | Sua tranquilidade fiscal... |
| `BLUE_EMAIL_CASE` | BLUE | EMAIL | Como resolvemos o caos cripto... |
| `BLUE_EMAIL_OFERTA` | BLUE | EMAIL | 20% OFF para blindar seu IR... |
| `TOKENIZA_EMAIL_CASE` | TOKENIZA | EMAIL | O investimento que rendeu 18%... |
| `TOKENIZA_EMAIL_OFERTA` | TOKENIZA | EMAIL | Nova emissao disponivel... |
| `BLUE_EMAIL_ONBOARDING_1` | BLUE | EMAIL | (step 1 do Onboarding Blue) |
| `BLUE_EMAIL_ONBOARDING_2` | BLUE | EMAIL | (step 2 do Onboarding Blue) |

## Cadencia "Onboarding Blue" - Ajuste nos Steps

A cadencia `BLUE_EMAIL_ONBOARDING` usa `BLUE_EMAIL_TESTE` em ambos os steps. Vou:
1. Criar `BLUE_EMAIL_ONBOARDING_1` (Apresentacao Blue - reutilizando o conteudo de `APRESENTACAO_BLUE`) 
2. Criar `BLUE_EMAIL_ONBOARDING_2` (Case Blue - reutilizando o conteudo de `BLUE_EMAIL_CASE`)
3. Atualizar os steps da cadencia para apontar para esses novos codigos

**Alternativa**: Se preferir, posso apontar os steps diretamente para `APRESENTACAO_BLUE` e `BLUE_EMAIL_CASE` sem criar templates duplicados.

## Implementacao Tecnica

1. **INSERT em `message_templates`**: 12 registros com os textos aprovados, todos com `ativo = true`
2. **UPDATE em `cadence_steps`**: Atualizar os 2 steps da cadencia Onboarding Blue (`61c393fa-ef37-4edf-bb79-851cd5747566`) para usar os novos codigos ao inves de `BLUE_EMAIL_TESTE`
3. **Nenhuma alteracao de codigo**: O motor de cadencias ja resolve templates por `empresa` + `codigo`, entao nao precisa de mudancas no frontend ou edge functions

## Resultado Esperado

Todas as 7 cadencias existentes terao templates reais com conteudo profissional de SDR (persona Amelia), prontos para execucao automatica pelo motor de cadencias.
