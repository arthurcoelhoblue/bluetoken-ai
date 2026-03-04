

## Problema: Badge "Somente Leitura" e sistema legado

O Tiago tem `READONLY` na tabela `user_roles` (legada) mas perfil **Administrador** no sistema de access profiles. O badge "Somente Leitura" aparece na sidebar e na página de perfil porque o código exibe roles legadas diretamente.

Além disso, o `useScreenPermissions` retorna as permissões corretas do perfil Administrador, e o `useIsAdmin()` detecta que ele é admin. A navegação e os botões de edição devem funcionar. O problema visível é o badge enganoso.

### Correções

**1. Sidebar — Trocar RoleBadge legado por nome do perfil de acesso**

**Arquivo:** `src/components/layout/AppSidebar.tsx`
- Remover `RoleBadge` do footer
- Exibir o nome do perfil de acesso (`Administrador`, `Closer`, etc.) obtido de uma query simples
- Se não tem perfil, exibir a role legada como fallback

**2. Página Me — Mostrar perfil de acesso**

**Arquivo:** `src/pages/Me.tsx`
- Substituir os `RoleBadge` legados pelo nome do perfil de acesso atribuído
- Manter roles legadas apenas como informação secundária (ou remover)

**3. Remover role READONLY do Tiago na tabela legada**

Como o sistema migrou para access profiles, a role `READONLY` no `user_roles` é vestigial e causa confusão. Atualizar os dados para que todos os usuários com perfil de acesso atribuído tenham sua role legada alinhada (ou removida).

**Opção mais segura:** Usar o insert tool para deletar a role `READONLY` do Tiago (e outros usuários com perfis atribuídos), já que o `has_role` agora verifica `user_access_assignments`.

### Arquivos envolvidos

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AppSidebar.tsx` | Editar — mostrar nome do perfil de acesso no footer |
| `src/pages/Me.tsx` | Editar — mostrar perfil de acesso em vez de roles legadas |
| Dados: `user_roles` | Limpar roles legadas de usuários com access profiles atribuídos |

