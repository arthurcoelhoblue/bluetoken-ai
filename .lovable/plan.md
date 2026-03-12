

## Plano: Associações de Contato e Organização no Deal (estilo Pipedrive)

### O que muda

Substituir os campos de texto "Contato" e "Organização" na aba Dados por **seções de associação** visuais, semelhantes ao Pipedrive (como no print). Cada seção mostra um card clicável com dados resumidos, opção de trocar e remover a associação.

### Estrutura visual

```text
┌─ Contatos (1)                    + Associar ─┐
│  👤 João Silva                               │
│  📧 joao@email.com                           │
│  📞 (11) 99999-0000                          │
│                              [✕ Desassociar] │
├──────────────────────────────────────────────┤
│                                              │
├─ Organização (1)                 + Associar ─┤
│  🏢 Empresa XYZ                              │
│                              [✕ Desassociar] │
└──────────────────────────────────────────────┘
```

- Clicar no nome do contato abre o `ContactDetailSheet`
- Clicar no nome da organização abre o `OrgDetailSheet`
- Botão "+ Associar" abre um Popover com busca para trocar/vincular
- Botão "Desassociar" remove o vínculo (seta `contact_id` ou `organization_id` para `null`)

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/deals/DealAssociations.tsx` | **Novo** — Componente com seções Contato e Organização como cards clicáveis |
| `src/components/deals/DealDadosTab.tsx` | **Editar** — Remover linhas de Contato/Organização como campos