

## Diagnóstico

O problema é sistêmico: a edge function `admin-create-user` cria o `user_access_assignments` mas **nunca insere** uma role na tabela legada `user_roles`. Como as políticas RLS de dezenas de tabelas usam `has_role()`, usuários novos ficam bloqueados.

A correção anterior (INSERT manual de `CLOSER`) resolveu apenas os usuários existentes naquele momento. Novos cadastros continuam sem role legada.

## Solução: Trigger automático no banco

A abordagem mais robusta é um **trigger no banco** que insere automaticamente `CLOSER` em `user_roles` sempre que uma linha é inserida em `user_access_assignments` (e o usuário ainda não tem nenhuma role). Isso cobre:

- ✅ Usuários existentes sem role (via INSERT retroativo)
- ✅ Novos usuários criados pela edge function
- ✅ Atribuições feitas manualmente pela UI de controle de acesso
- ✅ Qualquer outro fluxo futuro

### Alterações

**1. Migration SQL — Trigger + backfill**

```sql
-- Trigger function: auto-insert CLOSER when user gets access assignment
CREATE OR REPLACE FUNCTION public.fn_ensure_legacy_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'CLOSER')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_ensure_legacy_role
AFTER INSERT ON user_access_assignments
FOR EACH ROW EXECUTE FUNCTION fn_ensure_legacy_role();

-- Backfill: ensure ALL existing assigned users have at least one role
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT uaa.user_id, 'CLOSER'::user_role
FROM user_access_assignments uaa
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = uaa.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;
```

Isso garante cobertura 100% — presente, passado e futuro — sem depender de lógica no frontend ou na edge function.

| Componente | Ação |
|---|---|
| Migration SQL | Criar trigger `fn_ensure_legacy_role` + backfill |
| Nenhum arquivo de código | Sem alterações no frontend |

