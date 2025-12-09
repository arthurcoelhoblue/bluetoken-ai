# PATCH 5I - Placeholders Inteligentes

## Status: ✅ Implementado

## Objetivo
Permitir que mensagens de cadência usem dados reais e dinâmicos de ofertas Tokeniza, além dos dados básicos do lead.

---

## Entregas

### 1. Placeholders Suportados

#### Lead (básicos)
| Placeholder | Descrição | Exemplo |
|-------------|-----------|---------|
| `{{nome}}` | Nome completo do lead | João Silva |
| `{{primeiro_nome}}` | Primeiro nome | João |
| `{{lead_nome}}` | Alias para nome | João Silva |
| `{{email}}` | Email do lead | joao@email.com |
| `{{empresa}}` | Nome da empresa (Tokeniza/Blue) | Tokeniza |

#### Oferta Tokeniza (dinâmicos)
| Placeholder | Descrição | Exemplo |
|-------------|-----------|---------|
| `{{oferta_nome}}` | Nome da oferta ativa | Solar Farm III |
| `{{oferta_rentabilidade}}` | Rentabilidade | 18% a.a. |
| `{{oferta_prazo}}` | Duração em dias | 365 dias |
| `{{oferta_tipo}}` | Tipo de investimento | Equity |
| `{{oferta_url}}` | URL do site da empresa | https://empresa.com.br |
| `{{oferta_garantia}}` | Tipo de risco/garantia | Baixo |
| `{{oferta_minimo}}` | Contribuição mínima | R$ 1.000 |
| `{{oferta_captado}}` | Percentual captado | 75% |
| `{{oferta_dias_restantes}}` | Dias até encerramento | 15 |

---

### 2. Arquivos Modificados

```
supabase/functions/cadence-runner/index.ts
├── + Interface TokenizaOferta
├── + Função buscarOfertaAtiva()
├── ~ Função resolverPlaceholders() (expandida)
└── ~ Função resolverMensagem() (integrada com ofertas)
```

---

### 3. Fluxo de Resolução

```
1. Template contém placeholders
   "Olá {{primeiro_nome}}! Conheça {{oferta_nome}} com {{oferta_rentabilidade}}"

2. Cadence Runner processa
   ├── Busca dados do lead (lead_contacts)
   ├── Busca oferta ativa (tokeniza-offers) [apenas TOKENIZA]
   └── Substitui placeholders

3. Mensagem final
   "Olá João! Conheça Solar Farm III com 18% a.a."
```

---

### 4. Regras de Negócio

1. **Ofertas só para TOKENIZA**: Placeholders de oferta só são resolvidos para empresa TOKENIZA
2. **Fallback gracioso**: Se não houver oferta ativa, placeholders de oferta são removidos
3. **Cache implícito**: Edge function tokeniza-offers já tem cache de 5 minutos
4. **Primeira oferta aberta**: Usa a primeira oferta com status 'open'

---

### 5. Exemplo de Template

```
Olá {{primeiro_nome}}! 👋

Temos uma oportunidade imperdível para você:

🚀 *{{oferta_nome}}*
📈 Rentabilidade: {{oferta_rentabilidade}}
⏱️ Prazo: {{oferta_prazo}}
💰 Investimento mínimo: {{oferta_minimo}}

Já captamos {{oferta_captado}} e restam apenas {{oferta_dias_restantes}} dias!

Acesse: {{oferta_url}}

Abraço,
Equipe {{empresa}}
```

---

### 6. Logs Esperados

```
[Oferta] Oferta ativa encontrada: Solar Farm III
[Template] Resolvendo: { empresa: 'TOKENIZA', templateCodigo: 'BOAS_VINDAS_V1', canal: 'WHATSAPP' }
[Template] Placeholders resolvidos com oferta: Solar Farm III
```

---

### 7. Como Testar

1. Criar template com placeholders de oferta
2. Iniciar cadência para lead TOKENIZA
3. Executar cadence-runner
4. Verificar mensagem gerada em `lead_messages`

---

## Próximo Patch
**PATCH 5J** - Dashboard Operacional do SDR IA
