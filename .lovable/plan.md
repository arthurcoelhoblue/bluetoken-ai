

# Diagnóstico: Widget de telefonia "morto"

## Causa Raiz
A política RLS de SELECT na tabela `zadarma_extensions` está configurada para o role `public` (anon), mas o usuário logado usa o role `authenticated`. Resultado: a query retorna vazio, `hasExtension = false`, e o widget mostra "Nenhum ramal configurado" mesmo com o ramal existindo no banco.

**Todas as outras tabelas** (contacts, deals, pipelines) usam `roles: {authenticated}` — a `zadarma_extensions` é a exceção com bug.

## Correção

### 1. Corrigir RLS policy da `zadarma_extensions`
Migração SQL para dropar a policy atual de SELECT e recriá-la com `TO authenticated`:

```sql
DROP POLICY "Authenticated SELECT zadarma_extensions" ON zadarma_extensions;
CREATE POLICY "Authenticated SELECT zadarma_extensions" 
  ON zadarma_extensions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'ADMIN'::user_role) 
    OR (empresa::text = ANY(get_user_empresas(auth.uid())))
  );
```

### 2. Adicionar loading state ao widget
Enquanto a query de extension está carregando (`isLoading`), mostrar indicador de carregamento em vez de "Nenhum ramal configurado" — evita flash de erro durante o carregamento.

### 3. Verificar policy de `zadarma_config` também
A policy de SELECT em `zadarma_config` pode ter o mesmo bug — verificar e corrigir se necessário.

## Resultado Esperado
Após a correção, o widget detecta o ramal 108 do usuário, mostra o botão "Ligar" em modo Callback (já que `sip_login` está null), e as chamadas funcionam normalmente.

