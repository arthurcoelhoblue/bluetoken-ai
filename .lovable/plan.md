

## Filtro de empresa global na pagina de Conversas

### Problema
A pagina `/conversas` usa um estado local (`empresaFilter`) independente do seletor global de empresa no sidebar (`CompanySwitcher` / `useCompany()`). Ao trocar a empresa no switcher global, as conversas nao acompanham.

### Solucao
Conectar a pagina de Conversas ao contexto global de empresa (`activeCompanies`) e remover o seletor local de empresa duplicado.

### Mudancas

**1. `src/hooks/useAtendimentos.ts`**
- Alterar `empresaFilter` de `'TOKENIZA' | 'BLUE' | null` para aceitar um array de empresas (`ActiveCompany[]`).
- Aplicar filtro `.in('empresa', empresas)` quando o array nao estiver vazio, em vez de `.eq('empresa', valor)`.

**2. `src/pages/ConversasPage.tsx`**
- Importar `useCompany` e usar `activeCompanies` em vez do estado local `empresaFilter`.
- Remover o `Select` de empresa local (ja existe o switcher global no sidebar).
- Passar `activeCompanies` para `useAtendimentos`.

**3. `src/pages/Atendimentos.tsx`** (mesma correcao para consistencia)
- Tambem usa filtro local de empresa. Alinhar ao contexto global da mesma forma.

### Detalhamento tecnico

No hook `useAtendimentos`:
```text
// Antes
empresaFilter?: 'TOKENIZA' | 'BLUE' | null

// Depois
empresaFilter?: ActiveCompany[]
```

Na query:
```text
// Antes
if (empresaFilter) query = query.eq('empresa', empresaFilter)

// Depois
if (empresaFilter?.length) query = query.in('empresa', empresaFilter)
```

Na pagina ConversasPage:
```text
// Antes
const [empresaFilter, setEmpresaFilter] = useState<...>(null);
const { data } = useAtendimentos({ empresaFilter });

// Depois
const { activeCompanies } = useCompany();
const { data } = useAtendimentos({ empresaFilter: activeCompanies });
```

O seletor de empresa local sera removido da UI, pois o switcher global no sidebar ja cumpre essa funcao.

