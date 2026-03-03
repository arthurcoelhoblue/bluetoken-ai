

## Mapeamento Elementor Completo -- Campos Adicionais e Ocultos

### Problema Atual

O formulario de mapeamento so permite 3 campos fixos (nome, email, telefone). Na pratica, formularios Elementor tem campos adicionais (empresa, cargo, CPF, interesse) e campos ocultos (UTMs, page URL, referrer). Nao ha como mapear esses dados extras hoje.

### Solucao

Expandir o `field_map` para suportar 3 categorias de campos, e atualizar o backend para processar todos eles.

**Categorias de campos:**

```text
1. Campos Principais (fixos): nome*, email*, telefone
2. Campos Adicionais (dinamicos): usuario adiciona pares "nome do campo" <-> "ID Elementor"
   Ex: empresa, cargo, cpf, interesse, cidade
3. Campos Ocultos (pre-definidos): UTMs + campos de rastreio
   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
   page_url, referrer, gclid, fbclid
```

### Mudancas

**1. Frontend -- `ElementorIntegrationManager.tsx`**

- Manter secao "Campos Principais" (nome, email, telefone) como esta
- Adicionar secao **"Campos Adicionais"** com botao "+ Adicionar Campo":
  - Cada linha: Input "Nome do campo na Amelia" + Input "ID do campo no Elementor" + botao remover
  - Permite mapear qualquer campo extra do formulario (ex: `empresa` -> `field_empresa`)
- Adicionar secao **"Campos Ocultos / Rastreio"** com toggles e inputs:
  - Lista pre-definida de campos UTM (utm_source, utm_medium, utm_campaign, utm_content, utm_term)
  - Campos extras: page_url, referrer, gclid, fbclid
  - Para cada um: toggle ativo + input do ID do campo no Elementor (caso venha como campo hidden no form)
- Todos os campos extras sao gravados no mesmo `field_map` JSONB existente (nao precisa de migration)
- Atualizar o snippet PHP gerado para incluir captura de UTMs via `$_GET` e campos hidden

**2. Backend -- `elementor-webhook/index.ts`**

- O backend ja itera sobre todo o `field_map` e ja extrai UTMs do body/query params
- Ajuste: enviar campos adicionais mapeados dentro de `campos_extras` no payload do `lp-lead-ingest`
- Ajuste: extrair `page_url`, `referrer`, `gclid`, `fbclid` do body e incluir nos `campos_extras`

**3. Snippet PHP atualizado**

- Gerar snippet que tambem captura `$_GET['utm_source']` etc. e campos hidden do formulario
- Incluir `page_url` via `$_SERVER['HTTP_REFERER']`

### Nao precisa de migration

O `field_map` ja e JSONB livre -- campos adicionais e ocultos cabem na mesma estrutura:
```json
{
  "nome": "field_name",
  "email": "field_email",
  "telefone": "field_phone",
  "empresa": "field_company",
  "cargo": "field_role",
  "utm_source": "field_utm_source",
  "page_url": "field_page_url"
}
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/settings/ElementorIntegrationManager.tsx` | Adicionar secoes de campos adicionais e ocultos no dialog + exibicao no accordion |
| `supabase/functions/elementor-webhook/index.ts` | Passar campos extras mapeados para `campos_extras`; extrair gclid/fbclid/page_url |

