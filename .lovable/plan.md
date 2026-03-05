

## Extrair tag de empresa (MPUPPE/AXIA) da UTM campaign e aplicar no deal

### Contexto
Leads que chegam via Elementor ou LP com IA para a BLUE_LABS trazem no `utm_campaign` o nome da empresa parceira (ex: "MPUPPE", "AXIA"). Hoje o deal é criado sem essa tag. Precisamos extrair automaticamente a empresa do `utm_campaign` e salvar como tag no deal.

### Alterações

**`supabase/functions/lp-lead-ingest/index.ts`** (função central que cria o deal):

1. Após montar o `metadataExtra` e antes do insert do deal, adicionar lógica para detectar empresa parceira no `utm_campaign`:
   - Normalizar `utm_campaign` para uppercase
   - Verificar se contém "MPUPPE", "AXIA" (ou outros parceiros futuros)
   - Se detectado, adicionar à lista de `tags` do deal (ex: `["MPUPPE"]`)
   - Também incluir as tags que já vêm do `lead.tags` (do contato)

2. No insert do deal (linha ~171-186), adicionar o campo `tags` com o array construído:
   ```
   tags: dealTags,  // ex: ["MPUPPE"] ou ["AXIA"]
   ```

3. Mapa de detecção — constante no topo do arquivo:
   ```typescript
   const PARTNER_TAGS: Record<string, string> = {
     'MPUPPE': 'MPUPPE',
     'AXIA': 'AXIA',
   };
   ```
   - O match será feito via `utm_campaign.toUpperCase().includes(key)`

### Resultado
- Todo deal criado via formulário externo para BLUE_LABS terá automaticamente a tag `MPUPPE` ou `AXIA` baseada no nome da campanha
- As tags ficam visíveis no Kanban e na ficha do deal
- Funciona tanto para Elementor quanto para LP com IA (ambos passam pelo `lp-lead-ingest`)

