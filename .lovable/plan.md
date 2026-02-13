

## Correção: RLS bloqueando criação de Forms de Captura

### Problema

A política RLS de INSERT na tabela `capture_forms` exige que `empresa = get_user_empresa(auth.uid())`. Porém, a maioria dos usuários tem `empresa = NULL` na tabela `user_access_assignments`, fazendo `get_user_empresa()` retornar NULL. Como `'BLUE' = NULL` é sempre falso em SQL, o INSERT é bloqueado.

### Solução

Ajustar a política de INSERT (e UPDATE/DELETE/SELECT) para usar a mesma lógica de fallback que outras partes do sistema já usam. Duas opções:

**Opção escolhida**: Criar políticas mais permissivas que permitam usuários autenticados com role ADMIN manipular forms, similar ao padrão já usado em outras tabelas do projeto.

### Mudanças

**1. Migration SQL** — Recriar as políticas RLS de `capture_forms`

Substituir as 4 políticas atuais (SELECT/INSERT/UPDATE/DELETE por empresa) por políticas que verificam se o usuário está autenticado e, para empresa NULL, permitem acesso a todas as empresas (comportamento ADMIN):

```sql
-- DROP das políticas atuais
DROP POLICY "Users can view forms from their empresa" ON public.capture_forms;
DROP POLICY "Users can insert forms for their empresa" ON public.capture_forms;
DROP POLICY "Users can update forms from their empresa" ON public.capture_forms;
DROP POLICY "Users can delete forms from their empresa" ON public.capture_forms;

-- Novas políticas com fallback para empresa NULL
CREATE POLICY "Users can view forms"
  ON public.capture_forms FOR SELECT
  USING (
    status = 'PUBLISHED'
    OR auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert forms"
  ON public.capture_forms FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can update forms"
  ON public.capture_forms FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete forms"
  ON public.capture_forms FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.get_user_empresa(auth.uid()) IS NULL
        OR empresa = public.get_user_empresa(auth.uid())
      )
    )
  );
```

Tambem remover as políticas duplicadas "Anyone can read published forms by slug" e "Service can manage all forms" pois agora estao consolidadas nas novas.

**2. Nenhuma mudança no frontend** — O hook `useCaptureForms` já envia `empresa = 'BLUE'` corretamente.

### Resultado Esperado

Após a migration, usuários autenticados (mesmo com empresa NULL no assignment) conseguirão criar, editar e excluir forms normalmente.
