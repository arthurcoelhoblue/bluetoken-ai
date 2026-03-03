

## Situação Atual

O componente `CalendarConfigPanel` foi criado em `src/components/calendar/CalendarConfigPanel.tsx` mas **não está sendo usado em nenhuma página**. Ele não aparece em nenhuma rota — o vendedor não tem como acessá-lo.

O local mais natural para colocá-lo é na página **Meu Perfil** (`/me` → `src/pages/Me.tsx`), que é onde o vendedor já está agora. Vou adicionar uma nova seção "Google Calendar" nessa página.

## Plano

**Modificar `src/pages/Me.tsx`:**
- Importar `CalendarConfigPanel`
- Adicionar uma nova `Card` entre "Alterar Senha" e "Informações da Sessão" com título "Calendário & Reuniões" e ícone `Calendar`
- Renderizar `<CalendarConfigPanel userId={user?.id} />` dentro dela
- O componente já tem toda a lógica de conectar Google, configurar disponibilidade e preferências de reunião

Alteração em **1 arquivo**, ~10 linhas adicionadas.

