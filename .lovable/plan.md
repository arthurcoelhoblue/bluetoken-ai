

## Plano: Tela de Gerenciamento de Conexões WhatsApp

### O que será criado

Uma nova seção dentro da aba **Canais** das configurações (`/admin/settings`) para gerenciar as conexões WhatsApp (números) por empresa. Permitirá listar, adicionar, editar e ativar/desativar conexões diretamente pelo sistema.

### Estrutura

1. **Novo componente `WhatsAppConnectionsManager`** - Seção dentro do `IntegrationsTab`, abaixo dos detalhes do WhatsApp, com:
   - Lista de conexões agrupadas por empresa (carregadas da tabela `whatsapp_connections`)
   - Para cada conexão: label, telefone, Phone Number ID, WABA ID, badges de status (ativo/padrão)
   - Toggle de ativo/inativo e botão para definir como padrão
   - Botão "Adicionar Número" que abre um dialog

2. **Dialog `AddEditConnectionDialog`** - Formulário com os campos:
   - Empresa (select dinâmico da tabela `empresas`)
   - Phone Number ID (obrigatório)
   - Business Account ID / WABA ID (obrigatório)
   - Label (ex: "Tokeniza Comercial")
   - Display Phone (formato exibição)
   - Verified Name
   - Checkbox "Definir como padrão"

3. **Integração no `IntegrationsTab`** - O componente será renderizado como parte dos detalhes expandidos do card Meta Cloud ou como seção própria na área "Canais por Empresa".

### Detalhes técnicos

- Tabela `whatsapp_connections` já existe com todos os campos necessários — nenhuma migração de banco necessária
- CRUD via Supabase client (`supabase.from('whatsapp_connections')`)
- Ao marcar uma conexão como padrão, as demais da mesma empresa serão desmarcadas automaticamente (update no frontend)
- Queries com `@tanstack/react-query` seguindo o padrão existente do projeto
- Validação com zod para os campos obrigatórios

