

# Roteamento Inteligente nos Forms de Captura (Paginas de Vendas)

## Resumo

Evoluir o sistema de Forms de Captura (`capture-form-submit`) para receber comandos e contexto de paginas de vendas externas, criando deals com roteamento inteligente baseado em temperatura e sinais de prioridade -- identico ao fluxo do SGT, mas acionado via formularios.

---

## O que muda

Hoje o `capture-form-submit` cria o deal no pipeline/estagio fixo configurado no builder do form. Com esta evolucao, a pagina de vendas podera enviar **metadados extras** no payload (temperatura, comando de prioridade, UTMs, valor investido, etc.) e o sistema fara o roteamento automatico:

```text
Pagina de vendas envia webhook
        |
        v
  capture-form-submit recebe payload
  (answers + metadata com temperatura, comando, UTMs)
        |
        v
  Contato criado/encontrado (ja existe)
        |
        v
  +-------------+-------------+-----------------+
  |             |             |                 |
  v             v             v                 v
COMANDO       QUENTE        MORNO            FRIO
"atacar"
  |             |             |                 |
  v             v             v                 v
Atacar        Estagio       Estagio          Estagio
agora!        config.       config.          config.
(is_priority) + Notifica   + Notifica       + Cadencia
              vendedor     vendedor         aquecimento
```

---

## Parte 1: Evolucao do payload do `capture-form-submit`

O campo `metadata` que ja existe no payload passara a aceitar campos opcionais de roteamento:

| Campo metadata | Tipo | Descricao |
|----------------|------|-----------|
| `temperatura` | `FRIO / MORNO / QUENTE` | Temperatura do lead vinda da pagina |
| `comando` | `atacar_agora` ou outro | Sinal de prioridade (ex: clicou "falar com atendente") |
| `utm_source` | string | UTM source |
| `utm_medium` | string | UTM medium |
| `utm_campaign` | string | UTM campaign |
| `utm_content` | string | UTM content |
| `utm_term` | string | UTM term |
| `gclid` | string | Google Click ID |
| `fbclid` | string | Facebook Click ID |
| `valor_investido` | string | Faixa de valores informada pelo lead |
| `contexto` | object | Qualquer dado extra da pagina de vendas |

O payload continua compativel com o formato atual -- os novos campos sao todos opcionais dentro de `metadata`.

---

## Parte 2: Logica de roteamento no Edge Function

### Arquivo: `supabase/functions/capture-form-submit/index.ts`

Apos criar o contato e ANTES de criar o deal, adicionar logica de roteamento:

1. **Detectar comando de prioridade**: se `metadata.comando === 'atacar_agora'`, buscar o stage com `is_priority = true` no pipeline configurado no form
2. **Aplicar temperatura**: se `metadata.temperatura` estiver presente, usar como temperatura do deal
3. **Roteamento do estagio**:
   - Comando `atacar_agora` → stage `is_priority` do pipeline
   - Sem comando → stage configurado no form builder (comportamento atual mantido)
4. **UTMs**: copiar UTMs do metadata para o deal
5. **Acao pos-criacao**:
   - Se QUENTE ou `atacar_agora` → criar notificacao para o owner do pipeline
   - Se FRIO → iniciar cadencia de aquecimento (`WARMING_INBOUND_FRIO_{empresa}`)
6. **Prevencao de duplicatas**: verificar deal ABERTO existente para mesmo contact_id + pipeline_id

---

## Parte 3: Evolucao do Form Builder (Frontend)

### Arquivo: `src/pages/CaptureFormBuilderPage.tsx`

Adicionar uma nova secao no painel lateral de configuracao chamada **"Webhook Externo"** que mostra:

- A URL do endpoint para integrar com paginas de vendas externas
- Exemplo de payload JSON com os campos de metadata aceitos
- Botao de copiar URL

Isso facilita para o usuario configurar a integracao nas paginas de vendas sem precisar ir em outra tela.

---

## Parte 4: Nenhuma migracao SQL necessaria

A coluna `is_priority` ja foi criada na migracao anterior. As cadencias de aquecimento ja existem. Nenhuma alteracao de banco e necessaria.

---

## Secao Tecnica

### Arquivos a editar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/capture-form-submit/index.ts` | Adicionar logica de roteamento inteligente baseado em metadata (~80 linhas) |
| `src/pages/CaptureFormBuilderPage.tsx` | Adicionar secao "Webhook Externo" com URL e exemplo de payload |
| `supabase/config.toml` | Adicionar `[functions.capture-form-submit] verify_jwt = false` (se ainda nao estiver) |

### Compatibilidade

- O payload atual dos forms publicos (`/f/:slug`) continua funcionando sem alteracao -- metadata simplesmente nao tera campos de roteamento e o comportamento sera o mesmo de hoje
- Paginas de vendas externas enviam POST direto para o endpoint com os campos extras em metadata

### Exemplo de payload da pagina de vendas

```json
{
  "slug": "oferta-tokeniza-2025",
  "answers": {
    "field_nome": "Joao Silva",
    "field_email": "joao@email.com",
    "field_telefone": "11999998888",
    "field_valor": "R$ 50.000 - R$ 100.000"
  },
  "metadata": {
    "temperatura": "QUENTE",
    "comando": "atacar_agora",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "tokeniza-cdb",
    "valor_investido": "50000-100000",
    "referrer": "https://tokeniza.com.br/oferta"
  }
}
```

