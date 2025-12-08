# 📚 Documentação do SDR IA

Este diretório contém toda a documentação técnica do sistema SDR IA.

## 📁 Estrutura

```
docs/
├── README.md                 # Este arquivo
├── CHANGELOG.md              # Log de mudanças do projeto
├── TEST-RESULTS.md           # Resumo de todos os testes
└── patches/
    ├── _TEMPLATE.md          # Template para novos patches
    ├── PATCH-1_*.md          # Documentação do Patch 1
    └── PATCH-2_*.md          # Documentação do Patch 2
```

## 🔗 Links Rápidos

- [CHANGELOG](./CHANGELOG.md) - Histórico de alterações
- [Resultados de Testes](./TEST-RESULTS.md) - Status dos testes

## 📦 Patches Implementados

| Patch | Descrição | Status |
|-------|-----------|--------|
| [PATCH 1](./patches/PATCH-1_autenticacao-google-rbac.md) | Autenticação Google + RBAC | ✅ Implementado |
| [PATCH 2](./patches/PATCH-2_webhook-sgt.md) | Webhook SGT + Normalizador | ✅ Implementado |

## 🚀 Próximos Patches

| Patch | Descrição | Status |
|-------|-----------|--------|
| PATCH 3 | Pipeline de Classificação IA | ⏳ Pendente |
| PATCH 4 | Integração WhatsApp | ⏳ Pendente |

## 📝 Como Contribuir

1. Ao implementar um novo patch, copie o template `_TEMPLATE.md`
2. Renomeie para `PATCH-N_descricao.md`
3. Preencha todas as seções
4. Atualize o CHANGELOG.md
5. Atualize este README.md
