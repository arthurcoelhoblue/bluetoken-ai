

# Corrigir inputs da tela de E-mail/SMTP

## Problemas identificados

1. **Inputs nao funcionam**: Cada tecla digitada dispara `updateSetting.mutate()` que salva no banco imediatamente. Isso causa re-render via `invalidateQueries`, resetando o valor do input antes do usuario terminar de digitar. Os campos nao sao controlados por estado local -- leem direto do banco.

2. **Intervalo em minutos**: O campo "Intervalo minimo" esta rotulado e armazenado como minutos (`interval_minutes`), mas deveria ser em segundos (`interval_seconds`).

## Solucao

### 1. Usar estado local com salvamento por debounce/blur

- Criar estados locais (`localSmtpConfig`, `localModoTeste`) inicializados a partir dos valores do banco via `useEffect`
- Os inputs controlam o estado local (digitacao fluida)
- Salvar no banco apenas no `onBlur` de cada campo (quando o usuario sai do input)
- Remover o salvamento a cada tecla

### 2. Renomear intervalo para segundos

- Renomear o campo de `interval_minutes` para `interval_seconds` na interface `SmtpConfig` e no `DEFAULT_SMTP_CONFIG`
- Atualizar o label de "Intervalo minimo (minutos)" para "Intervalo minimo (segundos)"
- Atualizar a descricao e o valor default (de 1 minuto para 30 segundos)

## Detalhes tecnicos

### Arquivo: `src/pages/EmailSmtpConfigPage.tsx`

**Estado local para SMTP:**
```
const [localSmtp, setLocalSmtp] = useState<SmtpConfig>(DEFAULT_SMTP_CONFIG);

useEffect(() => {
  setLocalSmtp(smtpConfig);
}, [JSON.stringify(smtpConfig)]);
```

**Handlers atualizados:**
- `onChange` atualiza apenas `setLocalSmtp`
- `onBlur` dispara `updateSetting.mutate()` com o valor atual do estado local

**Estado local para modo teste:**
- Mesmo padrao: `localModoTeste` com `useEffect` de sync e save no `onBlur`

**Renomear campo:**
- `interval_minutes` vira `interval_seconds` na interface, default e todos os handlers
- Label: "Intervalo minimo (segundos)"
- Default: 30

### Arquivo unico alterado
- `src/pages/EmailSmtpConfigPage.tsx`

