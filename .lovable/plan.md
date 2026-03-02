

## Diagnóstico

A tabela `whatsapp_connections` tem apenas duas políticas RLS:
1. **SELECT** para `authenticated` — permite leitura
2. **ALL** para `service_role` — apenas backend interno

Falta políticas de **INSERT**, **UPDATE** e **DELETE** para usuários autenticados (admins).

## Solução

Criar uma migração SQL adicionando políticas RLS que permitam usuários autenticados com role ADMIN gerenciar as conexões:

```sql
-- INSERT policy
CREATE POLICY "Admins can insert whatsapp_connections"
ON public.whatsapp_connections FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);

-- UPDATE policy  
CREATE POLICY "Admins can update whatsapp_connections"
ON public.whatsapp_connections FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);

-- DELETE policy
CREATE POLICY "Admins can delete whatsapp_connections"
ON public.whatsapp_connections FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_access_assignments WHERE user_id = auth.uid())
);
```

Isso permite que qualquer usuário autenticado com acesso atribuído (presente em `user_access_assignments`) possa adicionar, editar e remover conexões WhatsApp.

Nenhuma alteração de código é necessária — apenas a migração de banco.

