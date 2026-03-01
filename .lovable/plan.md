

## Plano: Multi-select de tipos de atividade no gatilho de regra automática

### O que muda

No `AutoRulesTab.tsx`:

1. **State**: trocar `triggerActivityType` (string) por `triggerActivityTypes` (string array)
2. **Formulário de criação**: substituir o `Select` single por checkboxes (um por tipo de atividade: NOTA, LIGACAO, EMAIL, REUNIAO, TAREFA) para permitir seleção múltipla
3. **Validação**: exigir pelo menos um tipo selecionado quando o gatilho é `ATIVIDADE_CRIADA`
4. **trigger_config**: salvar como `{ tipos_atividade: ['NOTA', 'EMAIL'] }` (array) em vez de `{ tipo_atividade: 'NOTA' }` (string)
5. **Exibição das regras existentes**: renderizar múltiplos badges quando `trigger_config` contém `tipos_atividade` (array), mantendo retrocompatibilidade com o campo antigo `tipo_atividade` (string)
6. **Reset do form**: limpar o array ao fechar o dialog

### Retrocompatibilidade

Regras antigas com `tipo_atividade` (string singular) continuam exibindo corretamente — a lógica de renderização checa ambos os campos.

### Nenhuma mudança no backend

O campo `trigger_config` já é JSONB, aceita qualquer estrutura. O backend que consome essas regras precisará ser ajustado separadamente para checar o array, mas a configuração em si é salva corretamente.

