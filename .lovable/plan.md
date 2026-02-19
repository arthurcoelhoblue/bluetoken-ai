
# Substituir filtro "nao renovou" por filtro de data de renovacao

## O que muda

Remover o filtro "Comprou ano X, nao renovou ano Y" e substituir por dois date pickers que permitem filtrar clientes por periodo de renovacao (campo `proxima_renovacao`).

O usuario podera selecionar "Renovacao de" e "Renovacao ate" para ver apenas os clientes cuja data de renovacao cai naquele intervalo (ex: todos que renovam entre marco e junho de 2026).

## Alteracoes

### 1. Tipos (`src/types/customerSuccess.ts`)

- Remover `comprou_ano` e `nao_renovou_ano` de `CSCustomerFilters`
- Adicionar `renovacao_de?: string` e `renovacao_ate?: string` (formato ISO date)

### 2. Hook (`src/hooks/useCSCustomers.ts`)

- Remover toda a logica de `comprou_ano` / `nao_renovou_ano` (linhas 22-48 do bloco de contract filter)
- Simplificar `needsContractFilter` para checar apenas `ano_fiscal` e `contrato_status`
- Adicionar filtro direto na query principal de `cs_customers`:
  - Se `renovacao_de` preenchido: `.gte('proxima_renovacao', filters.renovacao_de)`
  - Se `renovacao_ate` preenchido: `.lte('proxima_renovacao', filters.renovacao_ate)`
- Esses filtros atuam direto na tabela `cs_customers` (campo `proxima_renovacao`), sem necessidade de join com `cs_contracts`

### 3. Pagina (`src/pages/cs/CSClientesPage.tsx`)

- Remover o `<Select>` de "Nao renovou" (linhas 94-105)
- Remover `fiscalYears` e `currentYear` (nao serao mais usados por nenhum filtro, o Ano Fiscal permanece)
- Adicionar dois date pickers usando Popover + Calendar (padrao Shadcn):
  - "Renovacao de" — define `filters.renovacao_de`
  - "Renovacao ate" — define `filters.renovacao_ate`
- Atualizar `hasAdvancedFilters` para checar `renovacao_de` ou `renovacao_ate` em vez de `comprou_ano`
- Atualizar `clearAdvancedFilters` para limpar `renovacao_de` e `renovacao_ate`

### Layout dos filtros (na mesma linha dos existentes)

```text
[Busca...] [Health Status v] [Ano Fiscal v] [Status Contrato v] [Renovacao de: __/__/__] [Renovacao ate: __/__/__] [Limpar]
```

Os date pickers usam botoes compactos com icone de calendario, mostrando a data selecionada ou placeholder.

## Secao tecnica

### Date picker pattern

Seguir o padrao Shadcn com `Popover` + `Calendar` e `pointer-events-auto` no className do Calendar:

```typescript
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}>
      <CalendarIcon className="mr-1 h-3.5 w-3.5" />
      {date ? format(date, "dd/MM/yy") : "Renovacao de"}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
  </PopoverContent>
</Popover>
```

### Query filter no hook

```typescript
if (filters.renovacao_de) query = query.gte('proxima_renovacao', filters.renovacao_de);
if (filters.renovacao_ate) query = query.lte('proxima_renovacao', filters.renovacao_ate);
```

Nao precisa de migracao SQL — `proxima_renovacao` ja existe na tabela `cs_customers`.
