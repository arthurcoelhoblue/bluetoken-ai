

# Botao "Abrir no Blue Chat" na pagina do Lead

## O que sera feito

Adicionar um botao com icone do WhatsApp na secao de Contato do lead, que abre diretamente a conversa no Blue Chat em uma nova aba.

## Onde aparece

Na pagina de detalhe do lead (`/leads/:leadId/:empresa`), dentro do card "Contato", logo abaixo do botao de teste WhatsApp existente e antes dos Links Externos. O botao so aparece quando o lead possui telefone.

## Formato do link

```text
https://chat.grupoblue.com.br/open/{COMPANY_SLUG}/{TELEFONE_NORMALIZADO}
```

- Telefone normalizado: apenas digitos, sem "+" (ex: `5511999887766`)
- Mapeamento de empresa para slug:
  - TOKENIZA -> `tokeniza`
  - BLUE -> `blue-consult`

## Visual do botao

- Icone: MessageCircle (Lucide) com estilo verde WhatsApp
- Texto: "Abrir no Blue Chat"
- Variante: outline com destaque verde
- Abre em nova aba (`target="_blank"`)

## Detalhes tecnicos

### Arquivo modificado

`src/pages/LeadDetail.tsx`

### Mudancas

1. Adicionar mapeamento `EMPRESA_TO_SLUG` no componente:
   - `{ TOKENIZA: 'tokeniza', BLUE: 'blue-consult' }`

2. Adicionar constante `BLUECHAT_BASE_URL`:
   - `https://chat.grupoblue.com.br`

3. Inserir botao entre o `WhatsAppTestButton` e o `Separator` / `ExternalLinks`, condicional a `contact.telefone` existir:
   - Normaliza telefone removendo caracteres nao-numericos
   - Monta URL com slug da empresa e telefone normalizado
   - Renderiza como `Button variant="outline"` com `asChild` wrapping um `<a>` com `target="_blank"`

4. Importar icone `MessageCircle` do lucide-react (ja tem outras importacoes de lucide no arquivo)
