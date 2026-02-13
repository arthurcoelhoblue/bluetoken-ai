

## Pendencias do Gestor — Acesso Principal + Meu Dia + Controle de Acesso

### Contexto

A funcionalidade "Pendencias de Perda" atualmente esta restrita a `/admin/pendencias-perda` com `requiredRoles: ['ADMIN']`, escondida no grupo "Configuracao" do sidebar. O usuario quer que:

1. Seja uma ferramenta de gestao (nao apenas perda) acessivel no menu principal
2. Apareca como card resumo no "Meu Dia" do gestor
3. Seja controlavel pelo sistema de perfis de acesso

### Alteracoes

#### 1. Registrar tela no screenRegistry

Adicionar entrada `pendencias_gestor` no `screenRegistry.ts` (a entrada `pendencias_perda` ja existe no sidebar mas nao no registry). Isso permite controlar visibilidade via perfis de acesso.

```
{ key: 'pendencias_gestor', label: 'Pendencias', group: 'Principal', icon: AlertTriangle, url: '/pendencias' }
```

#### 2. Mover rota de /admin/pendencias-perda para /pendencias

No `App.tsx`:
- Alterar a rota de `/admin/pendencias-perda` para `/pendencias`
- Remover `requiredRoles: ['ADMIN']` — o controle passa a ser feito pelo sistema de perfis de acesso (screenKey)

#### 3. Atualizar sidebar

No `AppSidebar.tsx`:
- Mover o item "Pendencias" do grupo "Configuracao" para o grupo "Principal" (abaixo de "Conversas")
- Atualizar url para `/pendencias` e screenKey para `pendencias_gestor`

#### 4. Card de pendencias no WorkbenchPage

No `WorkbenchPage.tsx`:
- Importar `useLossPendencyCount` de `useLossPendencies`
- Importar `useCanView` de `useScreenPermissions`
- Adicionar um card de alerta entre os KPIs e os paineis de SLA/Tarefas
- O card mostra o contador de pendencias e um botao "Resolver" que navega para `/pendencias`
- So renderiza se `useCanView('pendencias_gestor')` retorna true E o count > 0

#### 5. Atualizar titulo da pagina PendenciasPerda

No `PendenciasPerda.tsx`:
- Alterar titulo de "Pendencias de Perda" para "Pendencias do Gestor"
- Ajustar descricao para refletir o escopo mais amplo: "Resolva divergencias e tome decisoes sobre situacoes pendentes."

---

### Secao Tecnica — Arquivos

| Arquivo | Acao |
|---------|------|
| `src/config/screenRegistry.ts` | Editar — adicionar `pendencias_gestor` |
| `src/App.tsx` | Editar — rota `/pendencias` sem requiredRoles |
| `src/components/layout/AppSidebar.tsx` | Editar — mover item para grupo Principal |
| `src/pages/WorkbenchPage.tsx` | Editar — adicionar card de pendencias |
| `src/pages/admin/PendenciasPerda.tsx` | Editar — atualizar titulo e descricao |

