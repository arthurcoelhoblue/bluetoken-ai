

# Plano: Correções Build Errors + Base de Conhecimento Tokeniza

## 1. Corrigir Build Errors (4 arquivos com tipo empresa restrito)

Três locais ainda usam `'BLUE' | 'TOKENIZA'` em vez de `'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA'`:

- **`src/types/contactsPage.ts`**: Expandir `OrganizationWithStats.empresa` (line 49), `ContactFormData.empresa` (line 80), `OrganizationFormData.empresa` (line 96)
- **`src/components/templates/TemplateFormDialog.tsx`**: Expandir o `z.enum(['BLUE', 'TOKENIZA'])` no schema (line 23) para incluir MPUPPE e AXIA

## 2. Popular Base de Conhecimento Tokeniza via SQL

Executar o SQL do arquivo `tokeniza_knowledge_base.sql` como migration, **com as correções solicitadas pelo usuário**:

### Correções a aplicar no SQL antes de inserir:
1. **7 mil investidores, 30 milhões captados (TVL)** — substituir "72 mil investidores" por "7 mil investidores cadastrados com mais de R$ 30 milhões captados (TVL)"
2. **Taxa de 1.5% sobre vendas no mercado de transações subsequentes** — remover referência a "10% sobre o lucro do investidor"
3. **Nunca "mercado secundário"** → sempre "mercado de transações subsequentes"
4. **Não somos a única plataforma com selo da CVM** — remover afirmações de exclusividade/única
5. **Taxas pagas na maioria pelo captador** — ajustar FAQ de taxas

### Dados a inserir:
- 7 produtos (TOKENIZA_PLATFORM, IMOVEL, AGRO, FINANCE, STARTUP, AUTO, ATLETA)
- Seções de conhecimento (GERAL, PITCH, RISCOS, ESTRUTURA_JURIDICA) para o produto principal
- 8 FAQs aprovadas e visíveis para a Amélia
- 4 cadências (Inbound, MQL Quente, Carrinho Abandonado, Upsell)
- 14 templates de mensagem (WhatsApp + Email)
- Steps das cadências vinculados aos templates

## 3. Atualizar regras da Tokeniza no response-generator

Ajustar o bloco `empresa === 'TOKENIZA'` no `response-generator.ts` para incluir a instrução de nunca usar "mercado secundário".

