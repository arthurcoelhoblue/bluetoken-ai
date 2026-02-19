# Tratamento inteligente de leads, clientes e renovacoes vindos do SGT

## Contexto e problemas identificados

Hoje, 448 cs_customers importados, 0 contratos registrados, e varios problemas:

1. **Nomes poluidos com tags de campanha**: Contatos como `[ir-no-prazo] - David`, `[Renovacao 2026] - Rogerio Machado`, `Caio Campos Thomaz [Renovacao]` -- as tags ficam no nome do contato E no titulo do deal
2. **Leads de renovacao nao sao reconhecidos como clientes existentes**: Entram como novos contatos em vez de alimentar o historico do cliente ja cadastrado
3. **Aba Renovacao no CS esta vazia/inutil**: Mostra apenas 4 campos estaticos sem historico de compras, sem timeline de ganhos, sem calculo de elegibilidade
4. **Sem contratos automaticos**: Os 448 clientes nao tem nenhum contrato (`cs_contracts`) registrado, impedindo o controle de renovacoes

## Plano de acao

### 1. Limpeza de nomes (Name Sanitizer)

Criar funcao utilitaria `cleanContactName()` usada em todos os pontos de entrada:

**Regras de limpeza:**

- Remover tudo entre `[` e `]` (inclusive), ex: `[ir-no-prazo]`, `[Renovacao 2026]`, `[Black25]`
- Remover separadores orfaos: `-` no inicio/fim apos remocao das tags
- Remover anos soltos no fim: `- 2026`, `- B1`
- Remover `(copia)` e sufixos de duplicacao
- Trim e normalizar espacos duplos
- Extrair a tag de campanha como metadado separado antes de descarta-la

**Exemplos:**

- `[ir-no-prazo] - David` → nome: `David`, campanha: `ir-no-prazo`
- `[Renovacao 2026] - Rogerio Machado` → nome: `Rogerio Machado`, campanha: `Renovacao 2026`
- `Caio Campos Thomaz [Renovacao]` → nome: `Caio Campos Thomaz`, campanha: `Renovacao`
- `Éttore Mantovani Bottura[Renovacao 2026]` → nome: `Éttore Mantovani Bottura`, campanha: `Renovacao 2026`

**Onde aplicar:**

- `sgt-webhook/normalization.ts` → na funcao `normalizeSGTEvent` antes de retornar o nome
- `sgt-webhook/index.ts` → no titulo do deal manter campanha (ex: `David — ir-no-prazo — Inbound SGT`), mas nome do contato limpo
- `sgt-import-clientes` → ao enriquecer contatos

### 2. Deteccao de leads de renovacao no webhook

Adicionar logica no `sgt-webhook/index.ts` para detectar leads de renovacao:

**Criterios de deteccao:**

- Tag `[Renovacao]` ou `[Renovação]` no nome
- Campo `stage_atual = 'Cliente'` no payload SGT
- Match com `cs_customer` existente (via pessoa_id ou email/telefone)

**Comportamento quando detectado:**

1. Limpar o nome e buscar cliente existente no CS por pessoa_id/email/telefone
2. Se encontrar → vincular ao contact_id do cliente existente (nao criar novo contato)
3. Criar deal de renovacao vinculado ao contato do cliente existente, no pipeline de renovacao
4. Atualizar `cs_customers` com a data de proxima renovacao
5. Se NAO encontrar cliente existente → tratar como novo lead normalmente, mas com tag `renovacao-pendente  deixar pendência pro admin avaliar e impedir o cadastro duplicado` 

### 3. Criar contrato automatico ao ganhar deal (trigger)

Quando um deal muda para status `GANHO`:

- Criar automaticamente um registro em `cs_contracts` com:
  - `customer_id` do cs_customer correspondente (criado pela trigger `fn_deal_ganho_to_cs_customer`)
  - `ano_fiscal` = ano do fechamento
  - `plano` = extraido do deal ou "Padrao"
  - `valor` = valor do deal
  - `data_contratacao` = `fechado_em` do deal
  - `data_vencimento` = `fechado_em` + 12 meses
  - `status` = 'ATIVO'
- Calcular `proxima_renovacao` no cs_customer = `data_vencimento` - 90 dias (3 meses antes)
- Calcular `elegivel_renovacao` = `data_contratacao` + 9 meses

### 4. Reformular a aba Renovacao no detalhe do cliente CS

Substituir o card atual (4 campos estaticos) por uma interface completa:

**Timeline de compras:**

- Lista cronologica de todos os deals GANHOS desse cliente: 1o Ganho, 2o Ganho, etc.
- Cada item mostra: data, valor, plano, campanha de origem (utm_campaign)
- Indicador visual de quantos meses se passaram desde cada ganho

**Controle de elegibilidade:**

- "Elegivel para renovacao" = 9 meses apos ultimo ganho
- Barra de progresso mostrando tempo ate elegibilidade
- Status: `Nao elegivel` | `Elegivel` | `Em negociacao` | `Renovado` | `Churn`
- Dias restantes ate vencimento do contrato mais recente

**Contratos ativos:**

- Lista dos contratos do `cs_contracts` com status e datas
- Botao para registrar novo contrato manualmente (ja existe o `CSContractForm`)

**Alertas:**

- Destaque quando faltam menos de 90 dias para vencimento
- Alerta de churn quando passa da data e nao renovou

### 5. Carga retroativa de contratos para clientes existentes

Criar logica na `sgt-import-clientes` para:

- Para cada cs_customer com `data_primeiro_ganho` preenchido, criar um `cs_contract` com base nos deals GANHOS do contato
- Buscar todos os deals GANHOS do contato e criar um contrato para cada um
- Preencher `data_vencimento` = `fechado_em` + 12 meses
- Calcular `proxima_renovacao` baseado no contrato mais recente

### 6. Pipeline de Renovacao dedicado

Verificar se ja existe um pipeline do tipo `RENOVACAO` para Blue e Tokeniza. Se nao existir, orientar a criacao. Leads de renovacao devem ser roteados para esse pipeline em vez do comercial padrao.

---

## Secao tecnica

### Arquivo: `supabase/functions/_shared/name-sanitizer.ts` (NOVO)

```typescript
export function cleanContactName(rawName: string): { name: string; campaigns: string[] } {
  const campaigns: string[] = [];
  let name = rawName;
  // Extrair tags entre colchetes
  const tagRegex = /\[([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(rawName)) !== null) {
    campaigns.push(match[1]);
  }
  // Remover tags
  name = name.replace(/\[[^\]]*\]/g, '');
  // Remover separadores orfaos, anos, (copia)
  name = name.replace(/\s*-\s*$/g, '').replace(/^\s*-\s*/g, '');
  name = name.replace(/\s*-\s*\d{4}\s*$/g, '');
  name = name.replace(/\(cópia\)/gi, '');
  name = name.replace(/\s{2,}/g, ' ').trim();
  return { name: name || rawName, campaigns };
}
```

### Arquivo: `supabase/functions/sgt-webhook/normalization.ts`

- Importar `cleanContactName`
- Na funcao `normalizeSGTEvent`, aplicar limpeza ao `dados_lead.nome`
- Retornar campaigns extraidas no objeto normalizado (adicionar campo `campanhas_origem`)

### Arquivo: `supabase/functions/sgt-webhook/index.ts`

- Apos normalizacao, verificar se lead e de renovacao (tem tag Renovacao ou stage=Cliente)
- Se sim:
  - Buscar cliente existente por pessoa_id, email ou telefone
  - Se encontrar: reusar contact_id existente, criar deal de renovacao
  - Titulo do deal: `{nome_limpo} — Renovacao {ano} — {campanha}`
  - Registrar atividade no deal e no cs_customer
- Se nao e renovacao: fluxo normal com nome limpo

### Migracao SQL

```sql
-- Trigger para criar contrato automaticamente quando deal e ganho
CREATE OR REPLACE FUNCTION fn_deal_ganho_to_cs_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_empresa TEXT;
  v_cs_customer_id UUID;
  v_vencimento DATE;
  v_renovacao DATE;
BEGIN
  IF NEW.status = 'GANHO' AND OLD.status IS DISTINCT FROM 'GANHO' AND NEW.fechado_em IS NOT NULL THEN
    SELECT p.empresa::TEXT INTO v_empresa FROM pipelines p WHERE p.id = NEW.pipeline_id;
    
    SELECT id INTO v_cs_customer_id FROM cs_customers 
    WHERE contact_id = NEW.contact_id AND empresa = v_empresa;
    
    IF v_cs_customer_id IS NOT NULL THEN
      v_vencimento := (NEW.fechado_em + interval '12 months')::date;
      v_renovacao := (NEW.fechado_em + interval '9 months')::date;
      
      INSERT INTO cs_contracts (
        customer_id, empresa, ano_fiscal, plano, valor,
        data_contratacao, data_vencimento, status, notas
      ) VALUES (
        v_cs_customer_id, v_empresa,
        EXTRACT(YEAR FROM NEW.fechado_em)::int,
        'Padrao', COALESCE(NEW.valor, 0),
        NEW.fechado_em::date, v_vencimento, 'ATIVO',
        'Criado automaticamente a partir do deal ' || NEW.titulo
      ) ON CONFLICT (customer_id, ano_fiscal) DO NOTHING;
      
      UPDATE cs_customers SET
        proxima_renovacao = v_renovacao::text,
        updated_at = now()
      WHERE id = v_cs_customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deal_ganho_cs_contract
  AFTER UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION fn_deal_ganho_to_cs_contract();
```

### Frontend: `src/pages/cs/CSClienteDetailPage.tsx`

Reformular a aba `renovacao` (linhas 334-349):

- Buscar deals GANHOS do contato para montar timeline de compras
- Buscar contratos para exibir status
- Calcular elegibilidade: se ultimo ganho + 9 meses < hoje → elegivel
- Mostrar barra de progresso e alertas de vencimento
- Adicionar componente `CSRenovacaoTab` separado para manter o codigo organizado

### Novo componente: `src/components/cs/CSRenovacaoTab.tsx`

Componente dedicado que recebe `customerId`, `contactId`, `empresa` e renderiza:

- Timeline de ganhos (deals com status GANHO ordenados cronologicamente)
- Contratos ativos com status e datas
- Indicador de elegibilidade para renovacao
- Alertas de vencimento proximo (menos de 90 dias)
- Botao para registrar novo contrato

### Ajuste em `sgt-import-clientes` e `sgt-sync-clientes`

- Aplicar `cleanContactName()` ao processar contatos
- Atualizar nomes sujos no banco durante o sync
- Para clientes com deals GANHOS e sem contratos, criar contratos retroativamente

### Resumo das entregas

1. Name sanitizer compartilhado para limpar tags de campanha dos nomes
2. Deteccao inteligente de leads de renovacao no webhook, vinculando ao cliente existente
3. Trigger SQL para criar contratos automaticamente ao ganhar deals
4. Aba de Renovacao completa com timeline de compras, elegibilidade e alertas
5. Carga retroativa de contratos para os 448 clientes existentes
6. Roteamento de leads de renovacao para pipeline dedicado