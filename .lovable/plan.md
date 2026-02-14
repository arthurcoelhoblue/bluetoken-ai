

# Limpeza do Badge "Patch" com refinamento visual do PageShell

## Contexto

O componente `PageShell` hoje exibe um badge com texto de patch e usa um layout centralizado (`min-h-[60vh]`, `text-center`) que funciona como placeholder de pagina vazia. Porem, 5 das 6 paginas que usam o componente tem conteudo real abaixo dele, o que significa que o cabecalho ocupa 60% da tela antes do conteudo util aparecer. Ao remover o badge, vamos aproveitar para transformar o PageShell em um cabecalho de pagina profissional e compacto.

## Alteracoes

### 1. `src/components/layout/PageShell.tsx` - Redesign como Page Header

**Antes:** Componente centralizado ocupando 60vh com badge de patch.

**Depois:** Cabecalho de pagina elegante e compacto, alinhado a esquerda, com icone, titulo e descricao em linha. Remover a prop `patchInfo`, o import do `Badge` e a linha do badge. Reduzir o padding e remover o `min-h-[60vh]`. Usar layout horizontal (flex-row) com icone menor ao lado do titulo para um visual profissional de cabecalho.

A prop `patchInfo` sera removida da interface e todos os usos deixam de ser obrigatorios.

### 2. Paginas com conteudo (5 arquivos) - Remover `patchInfo`

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `ImportacaoPage.tsx` | `patchInfo="Patch 11"` | Remover prop, descricao atualizada para "Importe deals, contatos e organizacoes do Pipedrive para o CRM." |
| `CustomFieldsConfigPage.tsx` | `patchInfo="Patch 2 — Campos Customizáveis"` | Remover prop |
| `PipelineConfigPage.tsx` | `patchInfo="Patch 2 — Pipelines Reais"` | Remover prop |
| `AmeliaPage.tsx` | `patchInfo="Patch 6 + 12"` | Remover prop |
| `admin/PendenciasPerda.tsx` | `patchInfo="Gestão"` | Remover prop |

### 3. `IntegracoesPage.tsx` - Pagina placeholder (caso especial)

Esta pagina nao tem conteudo real, apenas o PageShell. Ao inves de usar o PageShell como cabecalho, vamos manter um layout centralizado inline (sem o componente PageShell) com uma mensagem profissional tipo "Em breve" ou simplesmente manter como cabecalho normal, ja que a configuracao de integracoes ja existe em Settings > Integracoes.

**Decisao:** Remover o `patchInfo` e manter o PageShell como cabecalho. A descricao ja e informativa.

## Resultado Visual Esperado

Antes (cada pagina):
```text
        [   icone grande   ]
        Titulo Centralizado
    Descricao centralizada aqui
        [ Patch 11 ]

--- conteudo real comeca aqui, la embaixo ---
```

Depois:
```text
[icone] Titulo da Pagina
        Descricao compacta aqui

--- conteudo real comeca logo abaixo ---
```

## Resumo de Impacto

- 7 arquivos editados
- Zero risco funcional
- UI mais profissional e compacta
- Conteudo das paginas fica visivel sem scroll

