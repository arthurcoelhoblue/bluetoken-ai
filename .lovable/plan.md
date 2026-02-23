
# Corrigir mensagens nao aparecendo na UI + sanitizacao cortando texto

## Problema 1: Mensagens nao aparecem na interface

A pagina do lead usa realtime para atualizar mensagens automaticamente (`useConversationMessages.ts` linhas 149-166). Porem, a tabela `lead_messages` **nao esta na publicacao `supabase_realtime`**, entao o subscription nunca recebe eventos e a UI nunca atualiza.

As mensagens existem no banco de dados (confirmado via query), mas o usuario precisa recarregar a pagina manualmente para ve-las.

### Correcao

Adicionar `lead_messages` a publicacao realtime via migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
```

---

## Problema 2: Texto cortado na sanitizacao

A IA gerou algo como:

> **Arthur, como e a sua primeira vez...**

O sanitizador anti-robotico (arquivo `response-generator.ts`, linha 61) tem esta regra:

```typescript
cleaned = cleaned.replace(new RegExp(`^${leadNome},?\\s*`, 'i'), '');
```

Isso remove "Arthur" do inicio, mas o resultado fica:

> **, como e a sua primeira vez...**

O problema: a regex remove o nome mas deixa a virgula/pontuacao que vem depois, gerando um texto que comeca com ", Arthur" (ou so a virgula).

Alem disso, na linha 32-35 do `detectRoboticPattern`, a deteccao por nome e acionada quando a mensagem comeca com o nome do lead, mas a limpeza nao trata corretamente o caso onde ha conteudo valido apos o nome.

### Correcao

Alterar a regex na linha 61 do `response-generator.ts` para tambem remover a pontuacao e espaco que seguem o nome:

```typescript
// Antes (remove nome mas deixa virgula):
cleaned = cleaned.replace(new RegExp(`^${leadNome},?\\s*`, 'i'), '');

// Depois (remove nome + virgula/ponto + espaco):
cleaned = cleaned.replace(new RegExp(`^${leadNome}[,.]?\\s*`, 'i'), '');
```

Mas isso ainda nao resolve 100% — se a IA gerou "Arthur, como e...", remover "Arthur, " deixa "como e..." (sem maiuscula). A logica de capitalizar na linha 72-74 ja cobre isso.

O problema real e que a deteccao (`detectRoboticPattern`) esta sendo muito agressiva. A mensagem "Arthur, como e a sua primeira vez..." nao e robotica — e uma resposta natural que usa o nome do lead. A regra na linha 32-35 detecta qualquer mensagem que comece com o nome do lead como "robotica", o que esta errado.

### Correcao aprimorada

1. **Tornar a deteccao por nome menos agressiva**: So detectar como robotico se o nome for seguido de padrao robotico (como "Arthur, que bom!" ou "Arthur, entendi!"), nao quando e parte natural da frase.

2. **Na sanitizacao, preservar o conteudo apos o nome**: Em vez de apagar o nome cegamente, verificar se o que sobra faz sentido.

Alteracao no `detectRoboticPattern` (linhas 32-35):

```typescript
// Antes: detecta QUALQUER mensagem que comeca com o nome do lead
if (leadNome) {
  const nomePattern = new RegExp(`^${leadNome},?\\s`, 'i');
  if (nomePattern.test(resposta)) return true;
}

// Depois: so detecta se o nome e seguido de padrao robotico
if (leadNome) {
  const roboticAfterName = new RegExp(
    `^${leadNome},?\\s+(entendi|perfeito|que bom|excelente|ótimo|claro|certo|legal|maravilha|show|beleza)`,
    'i'
  );
  if (roboticAfterName.test(resposta)) return true;
}
```

Alteracao no `sanitizeRoboticResponse` (linha 61):

```typescript
// Manter a regex mas so remover se foi detectado como robotico
// (a funcao so e chamada quando detectRoboticPattern retorna true)
// Ajustar para nao deixar virgula solta:
if (leadNome) {
  cleaned = cleaned.replace(new RegExp(`^${leadNome}[,;.!]?\\s*`, 'i'), '');
}
```

---

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Adicionar `lead_messages` ao `supabase_realtime` |
| `supabase/functions/sdr-ia-interpret/response-generator.ts` | Corrigir deteccao de nome para nao ser agressiva demais; ajustar sanitizacao para nao deixar pontuacao solta |

## Resultado esperado

1. As mensagens vao aparecer automaticamente na interface sem precisar recarregar a pagina
2. A Amelia vai poder usar o nome do lead naturalmente ("Arthur, como e...") sem que o sanitizador corte o texto
