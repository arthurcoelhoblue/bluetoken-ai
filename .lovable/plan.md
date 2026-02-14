

# Base de Conhecimento da Amelia: FAQ Colaborativa com Moderacao

## Visao Geral

Criar um sistema de **FAQ colaborativa** onde qualquer usuario com permissao pode cadastrar ou importar conhecimento para a Amelia. A Amelia monitora os cadastros e, quando necessario, envia para o gestor do autor aprovar/rejeitar na aba "Pendencias do Gestor". Se o autor nao tem gestor, a pendencia vai para todos os SUPER_ADMIN. Quando um gestor/admin resolve, resolve para todos.

Adicionalmente, renomear o item de menu de **"Knowledge Base"** para **"Base de Conhecimento"** no registro de telas e no sidebar.

## Renomeacao do Menu

| Arquivo | Campo | Antes | Depois |
|---------|-------|-------|--------|
| `src/config/screenRegistry.ts` | `label` (key: `knowledge_base`) | "Knowledge Base" | "Base de Conhecimento" |

Isso reflete automaticamente no sidebar e em qualquer lugar que use o `SCREEN_REGISTRY`.

## Modelo de Dados

Nova tabela `knowledge_faq`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | Identificador |
| empresa_id | UUID | Empresa (multi-tenant) |
| pergunta | TEXT NOT NULL | A pergunta ou titulo do item |
| resposta | TEXT NOT NULL | Resposta completa (Markdown) |
| categoria | TEXT | Categoria livre (ex: "Produto", "Processo", "Juridico", "Comercial") |
| tags | TEXT[] | Tags para busca e agrupamento |
| fonte | TEXT | Origem: 'MANUAL', 'IMPORTACAO', 'CONVERSA' |
| status | TEXT | 'RASCUNHO', 'PENDENTE', 'APROVADO', 'REJEITADO' |
| motivo_rejeicao | TEXT | Preenchido pelo gestor ao rejeitar |
| criado_por | UUID FK profiles | Quem cadastrou |
| aprovado_por | UUID FK profiles | Quem aprovou/rejeitou |
| aprovado_em | TIMESTAMPTZ | Quando foi decidido |
| produto_id | UUID FK product_knowledge | Vinculo opcional a um produto existente |
| visivel_amelia | BOOLEAN DEFAULT false | Se a Amelia pode usar na FAQ (true apos aprovacao) |
| created_at | TIMESTAMPTZ | Criacao |
| updated_at | TIMESTAMPTZ | Atualizacao |

### Regras de Status

```text
RASCUNHO --> (usuario publica) --> PENDENTE --> (gestor aprova) --> APROVADO (visivel_amelia = true)
                                            --> (gestor rejeita) --> REJEITADO (visivel_amelia = false)
```

- Itens com `status = 'APROVADO'` ficam com `visivel_amelia = true` e sao carregados no prompt da Amelia.
- Itens `RASCUNHO` podem ser editados livremente pelo autor antes de publicar.

## Integracao com Pendencias do Gestor

A pagina `PendenciasPerda` ja funciona como hub de decisoes. Vamos estende-la com uma nova secao/tipo de pendencia:

1. A query de pendencias passa a incluir FAQs com `status = 'PENDENTE'`
2. Para determinar o gestor: buscar `profiles.gestor_id` do autor
3. Se `gestor_id IS NULL`: exibir para todos os usuarios com role `ADMIN`
4. Quando um gestor resolve (aprova ou rejeita), o status e atualizado globalmente -- nao importa quantos gestores/admins viram a pendencia

### Card de Pendencia FAQ (na pagina de Pendencias)

Exibira:
- Pergunta e resposta cadastrada
- Categoria e tags
- Quem cadastrou e quando
- Botoes: **Aprovar** (publica na FAQ), **Rejeitar** (com campo de motivo), **Editar e Aprovar** (corrige e publica)

## UI: Tela de FAQ na Base de Conhecimento

A tela `/admin/produtos` sera expandida com uma **aba "FAQ"** (ao lado da listagem de produtos existente), usando o componente `Tabs`:

### Aba FAQ - Funcionalidades

1. **Listagem**: Cards com pergunta, categoria, status (badge colorido), autor
2. **Filtros**: Status, Categoria, Busca por texto
3. **Novo Item**: Dialog/formulario com campos:
   - Pergunta (obrigatorio)
   - Resposta (obrigatorio, textarea com suporte Markdown)
   - Categoria (select com opcoes pre-definidas + customizada)
   - Tags (input de chips)
   - Produto vinculado (select opcional dos produtos existentes)
   - Fonte: Manual ou Importacao (se importacao, campo para upload de arquivo texto/csv)
4. **Acoes**: Salvar como Rascunho | Publicar (envia para aprovacao)

### Categorias Pre-definidas

- Produto
- Processo Interno
- Juridico / Compliance
- Comercial / Vendas
- Financeiro
- Operacional
- Outros

## Hook e Logica

Novo hook `useKnowledgeFaq.ts`:
- `useKnowledgeFaqList(filters)` -- lista com filtros
- `useCreateFaq()` -- cria em RASCUNHO ou PENDENTE
- `useUpdateFaq()` -- edita rascunhos
- `useResolveFaq()` -- aprova/rejeita (atualiza status, visivel_amelia, aprovado_por/em)
- `useFaqPendencies()` -- busca FAQs pendentes para o gestor logado (ou para ADMINs se autor sem gestor)

### Logica de Roteamento de Pendencia

```text
1. Buscar FAQ com status = 'PENDENTE'
2. Para cada FAQ:
   a. Buscar gestor_id do criado_por (autor)
   b. Se gestor_id existe: pendencia aparece para esse gestor
   c. Se gestor_id IS NULL: pendencia aparece para todos com role ADMIN
3. Usuario logado ve apenas as pendencias onde ele e gestor do autor OU e ADMIN (quando autor sem gestor)
```

## Integracao com a Amelia

Os itens com `visivel_amelia = true` serao carregados junto com o `knowledge_sections` existente quando a Amelia monta o prompt. Funcao utilitaria `formatFaqForSDR()` gerara o bloco de FAQ no formato:

```text
## FAQ - Base de Conhecimento

**P: Como funciona o rendimento?**
R: O rendimento e calculado...

**P: Qual o prazo minimo?**
R: O prazo minimo e de...
```

## Arquivos Impactados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Criar tabela `knowledge_faq` com RLS |
| `src/config/screenRegistry.ts` | Renomear label de "Knowledge Base" para "Base de Conhecimento" |
| `src/types/knowledge.ts` | Adicionar tipos da FAQ |
| `src/hooks/useKnowledgeFaq.ts` | Novo hook CRUD + pendencias |
| `src/pages/admin/ProductKnowledgeList.tsx` | Adicionar aba "FAQ" com Tabs, atualizar titulo da pagina |
| `src/components/knowledge/FaqListTab.tsx` | Novo componente de listagem |
| `src/components/knowledge/FaqFormDialog.tsx` | Novo dialog de criacao/edicao |
| `src/hooks/useLossPendencies.ts` | Expandir para incluir pendencias de FAQ |
| `src/pages/admin/PendenciasPerda.tsx` | Adicionar card de pendencia FAQ |
| `src/types/knowledge.ts` | Funcao `formatFaqForSDR()` |

## Seguranca (RLS)

- SELECT: usuarios autenticados da mesma empresa
- INSERT: usuarios autenticados
- UPDATE: autor (se RASCUNHO) ou gestor/ADMIN (para resolver)
- DELETE: apenas autor (se RASCUNHO) ou ADMIN

