

# Controle de Acesso Multi-empresa para Deals

## Resumo

Implementar 4 funcionalidades inter-relacionadas:
1. Vendedores so veem seus proprios deals no pipeline (RLS + frontend)
2. Permissoes individuais por usuario que sobrepoe as do grupo/perfil
3. Deal obrigatoriamente com dono (owner_id NOT NULL com validacao)
4. Alerta de deals orfaos na aba Pendencias para o super admin Arthur

## Situacao Atual

- **123 deals abertos sem dono** (owner_id = NULL) -- serao listados como pendencia
- RLS atual: ADMIN ve tudo, CLOSER ve tudo, usuarios veem por empresa do pipeline -- nenhuma restricao por owner_id
- Sistema de perfis de acesso (access_profiles) ja existe com permissoes por tela (view/edit), mas nao tem override individual por usuario
- `CreateDealDialog` permite criar deal sem owner_id

---

## Parte 1: Vendedores So Veem Seus Deals (RLS)

### Banco de dados

Alterar a politica RLS `Users view deals by empresa` para adicionar filtro:
- Se o usuario tem `is_vendedor = true` e NAO e ADMIN, so ve deals onde `owner_id = auth.uid()`
- ADMIN e nao-vendedores continuam vendo todos os deals (respeitando filtro de empresa)

```sql
-- Dropar politica existente
DROP POLICY "Users view deals by empresa" ON deals;

-- Nova politica: vendedores so veem seus deals
CREATE POLICY "Users view deals by empresa and owner"
ON deals FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'ADMIN'::user_role)
  OR (
    -- vendedores: so seus deals
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_vendedor = true)
    AND owner_id = auth.uid()
  )
  OR (
    -- nao-vendedores: veem por empresa
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_vendedor = true)
    AND EXISTS (
      SELECT 1 FROM pipelines pip
      WHERE pip.id = deals.pipeline_id
      AND pip.empresa::text = get_user_empresa(auth.uid())
    )
  )
);
```

### Frontend

No `PipelinePage.tsx`, quando o usuario logado e vendedor (`is_vendedor = true`), o filtro "Vendedor" no Kanban deve vir pre-selecionado com o proprio usuario e desabilitado (nao pode mudar). Isso e uma conveniencia visual -- a restricao real ja esta no RLS.

---

## Parte 2: Permissoes Individuais por Usuario (Override do Grupo)

### Banco de dados

Criar coluna `permissions_override` (JSONB, nullable) na tabela `user_access_assignments`:

```sql
ALTER TABLE user_access_assignments
ADD COLUMN permissions_override JSONB DEFAULT NULL;
```

Este campo usa o mesmo formato do `PermissionsMap` dos perfis de acesso:
```json
{"pipeline": {"view": true, "edit": false}, "metas": {"view": false, "edit": false}}
```

**Regra de merge:**
- Se o usuario tem `permissions_override` para uma tela, usa a do usuario
- Se nao tem (campo ausente ou null), usa a do grupo/perfil
- Se o usuario nao tem grupo nem override, cai no fallback de roles legado

### Frontend

1. **`useScreenPermissions.ts`**: Apos carregar as permissoes do perfil, carregar tambem `permissions_override` do assignment e fazer merge (override tem prioridade)

2. **`UserAccessList.tsx`**: Adicionar botao "Permissoes individuais" ao lado de cada usuario, abrindo um dialog similar ao `AccessProfileEditor` mas mostrando 3 estados por tela: "Herdar do grupo" (default), "Permitir", "Negar"

3. **`AccessProfileEditor`** (ou novo componente `UserPermissionOverrideDialog`): Checkbox com 3 estados -- herdar / sim / nao -- para cada tela, em vez de apenas checkbox binario

---

## Parte 3: Deal Obrigatoriamente Com Dono

### Banco de dados

Criar trigger de validacao (nao CHECK constraint) para impedir INSERT/UPDATE sem owner_id:

```sql
CREATE OR REPLACE FUNCTION validate_deal_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Deal deve ter um vendedor (owner_id) atribuido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deal_owner_required
BEFORE INSERT ON deals
FOR EACH ROW EXECUTE FUNCTION validate_deal_owner();
```

Nota: O trigger so se aplica a novos deals. Deals existentes sem dono permanecem para serem corrigidos manualmente via pendencias.

### Frontend

- `CreateDealDialog.tsx`: Tornar campo `owner_id` obrigatorio (adicionar ao schema Zod, mostrar select de vendedores com asterisco)
- `DealDetailSheet.tsx`: Impedir salvar se owner_id for removido

---

## Parte 4: Alerta de Deals Orfaos nas Pendencias

### Hook novo: `useOrphanDeals.ts`

```typescript
// Query: deals WHERE owner_id IS NULL AND status = 'ABERTO'
// Retorna lista de deals orfaos para a tela de pendencias
```

### PendenciasPerda.tsx

Adicionar nova secao "Deals sem Vendedor" com cards mostrando:
- Titulo do deal, contato, pipeline, valor
- Botao para atribuir vendedor (select de profiles com is_vendedor = true)
- Badge de alerta laranja

Esta secao so aparece para usuarios ADMIN (Arthur).

---

## Arquivos a Criar/Modificar

| Arquivo | Mudanca |
|---------|---------|
| **Migracao SQL** | Nova politica RLS, coluna permissions_override, trigger validate_deal_owner |
| `src/hooks/useScreenPermissions.ts` | Merge de permissions_override do assignment |
| `src/hooks/useOrphanDeals.ts` | **Novo** - Query de deals sem owner |
| `src/pages/admin/PendenciasPerda.tsx` | Secao de deals orfaos com atribuicao |
| `src/pages/PipelinePage.tsx` | Pre-selecionar filtro owner para vendedores |
| `src/components/pipeline/CreateDealDialog.tsx` | Campo owner_id obrigatorio |
| `src/schemas/deals.ts` | owner_id obrigatorio no schema Zod |
| `src/components/settings/UserAccessList.tsx` | Botao de permissoes individuais |
| `src/components/settings/UserPermissionOverrideDialog.tsx` | **Novo** - Editor de override individual |
| `src/types/accessControl.ts` | Tipo para override de permissoes |

## Ordem de Implementacao

1. Migracao SQL (RLS + coluna override + trigger)
2. Backend: owner obrigatorio (trigger + frontend)
3. Pendencias de deals orfaos
4. Override de permissoes individuais
5. Filtro de vendedor no pipeline

