

# Corrigir acesso da Glauciane e prevenir reincidência

## Problema raiz
O trigger `handle_new_user()` atribui `READONLY` a novos usuários. O trigger que dá `CLOSER` só dispara quando o admin atribui um perfil de acesso via `user_access_assignments`. Se o admin não faz essa atribuição, o usuário fica preso em `READONLY`.

## Dados atuais da Glauciane
- **Email:** glauciane.rodrigues@tokeniza.com.br
- **Role:** READONLY (única)
- **Perfis de acesso:** 0 atribuições
- **Status:** Ativa

## Correções

### 1. Corrigir a Glauciane imediatamente (dados)
- UPDATE `user_roles` → trocar `READONLY` por `CLOSER`
- Ela também precisa de uma atribuição em `user_access_assignments` com empresa `TOKENIZA` para que o RLS funcione corretamente

### 2. Alterar o trigger `handle_new_user()` (migration)
Mudar o default de `READONLY` para `CLOSER` para novos usuários:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
...
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CLOSER');  -- era READONLY
  END IF;
```

### 3. Backfill: corrigir TODOS os usuários que estão só com READONLY
Qualquer outro usuário na mesma situação será corrigido:
```sql
UPDATE user_roles SET role = 'CLOSER'
WHERE role = 'READONLY'
AND user_id NOT IN (
  SELECT user_id FROM user_roles WHERE role != 'READONLY'
);
```

## Impacto
- A Glauciane terá acesso imediato
- Futuros usuários já entrarão com `CLOSER` em vez de `READONLY`
- Usuários existentes presos em READONLY serão corrigidos
- Nota: a Glauciane ainda precisará de um perfil de acesso atribuído pelo admin na tela de Controle de Acesso para ter permissões granulares corretas

