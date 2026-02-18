

# Unificar API Key do Blue Chat + Adicionar novas empresas (MPUPPE, AXIA)

## Resumo

Duas mudancas combinadas:
1. **API Key unica**: Usar apenas `BLUECHAT_API_KEY` para todas as empresas (eliminar `BLUECHAT_API_KEY_BLUE`)
2. **Novas empresas**: Adicionar MPUPPE e AXIA como tenants independentes no sistema
3. **Mapeamento de nomes**: O Blue Chat envia nomes como "Tokeniza", "Blue Consult", "Blue Cripto", "MPuppe", "Axia" -- o sistema precisa mapear para os enum values internos (TOKENIZA, BLUE, MPUPPE, AXIA)

---

## Parte 1 -- Banco de dados

### 1.1 Adicionar novos valores ao enum `empresa_tipo`

```sql
ALTER TYPE empresa_tipo ADD VALUE 'MPUPPE';
ALTER TYPE empresa_tipo ADD VALUE 'AXIA';
```

### 1.2 Criar registros em `integration_company_config` para novas empresas

Inserir configuracoes de canal (bluechat habilitado) para MPUPPE e AXIA.

### 1.3 Adicionar ICPs para novas empresas

Adicionar valores ao enum `icp_tipo`:
- `MPUPPE_NAO_CLASSIFICADO`
- `AXIA_NAO_CLASSIFICADO`

(Outros ICPs especificos podem ser adicionados depois conforme necessidade)

---

## Parte 2 -- Edge Functions (Backend)

### 2.1 Criar funcao de mapeamento de empresa (novo arquivo ou no `_shared/`)

Funcao `mapBluechatEmpresa` que converte os nomes vindos do Blue Chat para os enum internos:

| Blue Chat envia | Sistema interno |
|---|---|
| "Tokeniza" | TOKENIZA |
| "Blue", "Blue Consult", "Blue Cripto" | BLUE |
| "MPuppe" | MPUPPE |
| "Axia" | AXIA |

### 2.2 Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/_shared/types.ts` | Adicionar `MPUPPE` e `AXIA` ao tipo `EmpresaTipo` |
| `supabase/functions/_shared/tenant.ts` | Adicionar `MPUPPE` e `AXIA` ao `VALID_EMPRESAS` e `EMPRESAS` |
| `supabase/functions/_shared/channel-resolver.ts` | Usar apenas `BLUECHAT_API_KEY`; resolver `system_settings` por empresa (precisa de keys para mpuppe/axia) |
| `supabase/functions/bluechat-inbound/auth.ts` | Usar apenas `BLUECHAT_API_KEY`, remover `empresaFromKey` |
| `supabase/functions/bluechat-inbound/schemas.ts` | Aceitar os novos valores de empresa no Zod (`MPUPPE`, `AXIA`) + aceitar nomes "raw" do Blue Chat |
| `supabase/functions/bluechat-inbound/index.ts` | Usar `mapBluechatEmpresa()` para normalizar o campo empresa do payload |
| `supabase/functions/bluechat-inbound/callback.ts` | Usar apenas `BLUECHAT_API_KEY` |
| `supabase/functions/bluechat-proxy/index.ts` | Usar apenas `BLUECHAT_API_KEY` |
| `supabase/functions/_shared/pipeline-routing.ts` | Adicionar fallback para MPUPPE e AXIA (inicialmente roteando para pipeline generico ou criando pipelines dedicados) |

### 2.3 Logica do mapeamento (exemplo)

```typescript
const BLUECHAT_EMPRESA_MAP: Record<string, EmpresaTipo> = {
  'tokeniza': 'TOKENIZA',
  'blue': 'BLUE',
  'blue consult': 'BLUE',
  'blue cripto': 'BLUE',
  'mpuppe': 'MPUPPE',
  'axia': 'AXIA',
};

export function mapBluechatEmpresa(raw?: string): EmpresaTipo {
  if (!raw) return 'BLUE';
  const key = raw.trim().toLowerCase();
  return BLUECHAT_EMPRESA_MAP[key] || 'BLUE';
}
```

### 2.4 Auth simplificado

```typescript
// auth.ts -- apenas uma key
const bluechatApiKey = getOptionalEnv('BLUECHAT_API_KEY');
if (token && token.trim() === bluechatApiKey.trim()) {
  return { valid: true };
}
```

---

## Parte 3 -- Frontend

### 3.1 Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/contexts/CompanyContext.tsx` | Adicionar `MPUPPE` e `AXIA` ao tipo `ActiveCompany` e `LABELS` |
| `src/components/layout/CompanySwitcher.tsx` | Adicionar metadata (label/cor) para MPUPPE e AXIA |
| `src/types/classification.ts` | Adicionar ICPs e labels para MPUPPE e AXIA |
| `src/components/settings/BlueChatConfigDialog.tsx` | Ajustar para mostrar apenas uma API key compartilhada |
| `src/types/settings.ts` | Remover referencia a `BLUECHAT_API_KEY_BLUE` |

### 3.2 Labels das novas empresas

| Enum | Label display |
|---|---|
| MPUPPE | MPuppe |
| AXIA | Axia |

---

## Parte 4 -- Pipeline Routing para novas empresas

As novas empresas (MPUPPE, AXIA) ainda nao tem pipelines criados. O `pipeline-routing.ts` precisa de um fallback. Duas opcoes:

1. **Criar pipelines via migracao SQL** com stages padrao (Frio/Morno/Quente) para cada nova empresa -- ideal para funcionamento completo
2. **Usar um lookup dinamico** no banco ao inves de UUIDs hardcoded -- mais flexivel mas requer refatoracao

A abordagem recomendada e criar pipelines com stages padrao para MPUPPE e AXIA na migracao, e adicionar os UUIDs ao `pipeline-routing.ts`.

---

## Ordem de execucao

1. Migracao SQL (enum + integration_company_config + ICPs + pipelines)
2. Edge functions (mapeamento + unificacao de API key)
3. Frontend (CompanyContext + CompanySwitcher + labels)
4. Deploy das edge functions
5. Testar fluxo end-to-end com mensagem simulada

---

## Importante

- O secret `BLUECHAT_API_KEY_BLUE` podera ser removido apos a implementacao
- O secret `BLUECHAT_API_KEY` deve estar valido e configurado
- Usuarios que precisam acessar MPUPPE ou AXIA devem receber entradas em `user_access_assignments`
- A funcao `provision_tenant_schema` existente ja suporta novos tenants automaticamente (basta chamar com o novo nome)

