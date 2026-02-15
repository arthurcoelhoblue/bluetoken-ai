# 📚 Documentação do Amélia CRM (SDR IA)

Este diretório contém toda a documentação técnica do sistema.

## 📁 Estrutura

```
docs/
├── README.md                 # Este arquivo
├── CHANGELOG.md              # Log de mudanças do projeto
├── TEST-RESULTS.md           # Resumo de todos os testes (51+)
└── patches/
    ├── _TEMPLATE.md          # Template para novos patches
    └── PATCH-*_*.md          # Documentação de cada patch
```

## 🔗 Links Rápidos

- [CHANGELOG](./CHANGELOG.md) - Histórico de alterações
- [Resultados de Testes](./TEST-RESULTS.md) - Status dos testes

## 📦 Patches Implementados

| Patch | Descrição | Status |
|-------|-----------|--------|
| [PATCH 1](./patches/PATCH-1_autenticacao-google-rbac.md) | Autenticação Google + RBAC | ✅ Implementado |
| [PATCH 2](./patches/PATCH-2_webhook-sgt.md) | Webhook SGT + Normalizador | ✅ Implementado |
| [PATCH 3](./patches/PATCH-3_classificacao-comercial.md) | Classificação Comercial IA | ✅ Implementado |
| [PATCH 4](./patches/PATCH-4_motor-cadencias.md) | Motor de Cadências | ✅ Implementado |
| [PATCH 5](./patches/PATCH-5_mensageria-sdr-ia.md) | Mensageria + SDR IA | ✅ Implementado |
| [PATCH 6](./patches/PATCH-6_sdr-conversacional-inteligente.md) | SDR Conversacional | ✅ Implementado |
| PATCH 13 | [Telefonia Zadarma](./patches/PATCH-13_zadarma-telefonia.md) | ✅ Implementado |

## 🏗️ Fases de Consolidação

| Fase | Descrição | Status |
|------|-----------|--------|
| Fase 1 | Governança IA + Custos + Adoção | ✅ Concluída |
| Fase 2 | Módulo Customer Success | ✅ Concluída |
| Fase 3 | Auditoria + Testes E2E | ✅ Concluída |

## 📝 Como Contribuir

1. Ao implementar um novo patch, copie o template `_TEMPLATE.md`
2. Renomeie para `PATCH-N_descricao.md`
3. Preencha todas as seções
4. Atualize o CHANGELOG.md
5. Atualize este README.md
