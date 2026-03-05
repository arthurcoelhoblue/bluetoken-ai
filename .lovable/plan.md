

## Importação Lista Axia — Plano Corrigido

### Configuração

| Campo | Valor | ID |
|-------|-------|----|
| **Empresa** | BLUE_LABS | `BLUE_LABS` |
| **Pipeline** | Funil Comercial | `2de90016-ff26-48d3-af69-9ef1480cd506` |
| **Primeira etapa** | MQL | `c904d4ef-1071-443d-983d-42c33cd2d8af` |
| **Vendedor** | Rodrigo Oliveira | `221ec231-ad88-4514-b9f1-8170679483b7` |
| **Tag** | `Lista Axia` | — |
| **Canal origem** | `LISTA_AXIA` | — |

### Dados da planilha

~306 linhas com campos: First Name, Last Name, Job Titles, Company, E-mail, Phone, Employees, Industries, Person Linkedin, Website, Company Linkedin, City.

### Execução

Inserir todos os registros válidos (com email) via SQL (insert tool) em lotes de ~50, usando CTEs para criar atomicamente:

1. **Contato** na tabela `contacts`:
   - `nome` = First Name + Last Name
   - `primeiro_nome` = First Name
   - `sobrenome` = Last Name
   - `email` = E-mail
   - `telefone` = Phone
   - `empresa` = `BLUE_LABS`
   - `canal_origem` = `LISTA_AXIA`
   - `tags` = `["Lista Axia"]`
   - Metadados LinkedIn: Person Linkedin em campo relevante, Job Titles como cargo, Company como empresa do contato, Industries como setor, City como cidade

2. **Deal** na tabela `deals` para cada contato criado:
   - `titulo` = First Name + Last Name
   - `contact_id` = ID do contato criado
   - `pipeline_id` = `2de90016-ff26-48d3-af69-9ef1480cd506`
   - `stage_id` = `c904d4ef-1071-443d-983d-42c33cd2d8af`
   - `owner_id` = `221ec231-ad88-4514-b9f1-8170679483b7`
   - `status` = `ABERTO`
   - `temperatura` = `FRIO`
   - `canal_origem` = `LISTA_AXIA`
   - `tags` = `["Lista Axia"]`
   - `valor` = 0

3. **Deduplicação**: antes de inserir, verificar se já existe contato com o mesmo email na empresa `BLUE_LABS`. Se existir, pular (não criar contato nem deal duplicado).

### Implementação técnica

- Executar via `insert tool` (SQL direto), sem migração de schema
- Lotes de ~50 registros para evitar timeout
- CTE pattern: `WITH new_contact AS (INSERT INTO contacts ... RETURNING id) INSERT INTO deals ... SELECT id FROM new_contact`
- Filtrar linhas sem email válido
- Total estimado: ~6-7 lotes

