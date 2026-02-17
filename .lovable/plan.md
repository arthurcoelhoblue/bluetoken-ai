

# Proteger campo `is_active` - Apenas ADMINs podem inativar usuarios

## Problema atual

A politica RLS "Users can update their own profile" permite que qualquer usuario autenticado atualize **qualquer coluna** do proprio perfil, incluindo `is_active`. Embora a tela de Controle de Acesso ja seja restrita a admins, uma chamada direta ao banco (via console do navegador, por exemplo) permitiria que um usuario manipulasse o campo `is_active`.

## Solucao

Duas camadas de protecao:

### 1. Trigger no banco de dados (protecao principal)

Criar um trigger `BEFORE UPDATE` na tabela `profiles` que impede a alteracao de `is_active` por usuarios que nao sejam ADMIN.

```sql
CREATE OR REPLACE FUNCTION public.prevent_non_admin_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se is_active nao mudou, permitir
  IF OLD.is_active IS NOT DISTINCT FROM NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Verificar se o caller e ADMIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Apenas administradores podem ativar/inativar usuarios';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_non_admin_deactivation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_deactivation();
```

### 2. UI: Ocultar toggle "Ativo" para nao-admins (camada visual)

No `EditUserDialog.tsx`, verificar se o usuario logado tem role ADMIN via `useAuth()`. Se nao for admin, esconder o campo `isActive` do formulario.

```typescript
const { roles } = useAuth();
const isAdmin = roles.includes('ADMIN');

// No form, renderizar condicionalmente:
{isAdmin && (
  <FormField name="isActive" ... />
)}
```

## Arquivos a modificar

| Arquivo | Tipo | Descricao |
|---|---|---|
| Nova migration SQL | Criar | Trigger `prevent_non_admin_deactivation` |
| `src/components/settings/EditUserDialog.tsx` | Editar | Condicionar toggle "Ativo" a role ADMIN |

## Impacto

- Nenhum usuario nao-admin consegue alterar `is_active`, nem via UI nem via chamada direta ao banco
- Admins continuam com o fluxo atual sem mudancas
- Zero impacto em outras funcionalidades

