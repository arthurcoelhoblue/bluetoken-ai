

# Incluir Data de Cadastro na Sincronização Tokeniza Gov

## Situação Atual

A API de exportação do Gov (`investor-export`) busca investidores mas **não inclui** o campo `created_at` no select:

```
.select("id, external_id, full_name, email, phone, document, person_type, kyc_status, suitability, is_active")
```

A data de cadastro na plataforma Tokeniza existe na tabela `investors.created_at` do Gov, mas não está sendo exportada nem consumida.

## Plano

### Passo 1 — Expor `created_at` na API de exportação (projeto Gov)

No arquivo `supabase/functions/investor-export/index.ts` do projeto [Tokeniza Gov Integration](/projects/f8d2848a-cdde-44c2-8a72-46b4113f9a87):
- Adicionar `created_at` ao select da tabela `investors` (linha 38)
- Incluir `registered_at: inv.created_at` no objeto retornado por investidor (linha 131-142)

### Passo 2 — Adicionar coluna `data_cadastro_plataforma` na tabela `contacts`

Nova coluna `timestamptz` nullable para armazenar a data de cadastro na plataforma Tokeniza, sem confundir com o `created_at` do nosso sistema (que é a data de criação do registro aqui na Amélia).

### Passo 3 — Consumir o campo no `tokeniza-gov-sync`

No `supabase/functions/tokeniza-gov-sync/index.ts`:
- Adicionar `registered_at` à interface `Investor`
- Gravar `data_cadastro_plataforma: investor.registered_at` no insert/update de `contacts`
- Também salvar em `sgt_dados_extras` do `cs_customers` como `data_cadastro_plataforma`

### Passo 4 — Exibir na UI

Mostrar a data de cadastro na plataforma nos detalhes do cliente CS, ao lado das outras informações do investidor.

## Detalhes Técnicos

- **Projeto Gov**: edição em `investor-export/index.ts` — 2 linhas
- **Migration**: `ALTER TABLE contacts ADD COLUMN data_cadastro_plataforma timestamptz`
- **Edge function**: `tokeniza-gov-sync/index.ts` — interface + insert/update
- **UI**: componente de detalhe do cliente CS

