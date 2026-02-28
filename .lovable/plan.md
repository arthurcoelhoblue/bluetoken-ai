

# Fix: Gravação desabilitada no ramal 108 + Resiliência do webhook

## Problema confirmado

Os dados do PBX Zadarma mostram que **todas** as chamadas do ramal 108 têm `is_recorded: false`. Sem gravação:
- `NOTIFY_RECORD` nunca é enviado
- `call-transcribe` nunca é invocado
- Transcrição, summary e coaching ficam indisponíveis

Comparação:
- Ramal 104: `is_recorded: true` ✅
- Ramal 105: `is_recorded: true` ✅
- Ramal 107: `is_recorded: true` ✅
- **Ramal 108: `is_recorded: false` ❌**

## Ação manual (fora do código)

Habilitar gravação no ramal 108 no dashboard Zadarma: **PBX → Extensions → 108 → Enable recording**.

## Correções de código (resiliência)

### 1. Fallback para fechar calls sem NOTIFY_OUT_END

O `NOTIFY_OUT_END` também não chegou para a última chamada, deixando o registro `RINGING` no banco. O `closeActiveCallRecord` que adicionamos na última iteração deveria resolver isso no frontend, mas precisamos garantir que ele esteja funcionando corretamente — verificar se o código de update está correto (o `.limit(1)` no update do Supabase pode não funcionar como esperado).

**Arquivo:** `src/hooks/useZadarmaWebRTC.ts`
- Corrigir `closeActiveCallRecord`: substituir `.order().limit(1)` por uma query que primeiro busca o ID do call record mais recente e depois faz o update por ID específico.

### 2. Alerta visual quando gravação está desabilitada

**Arquivo:** `src/components/admin/zadarma/ZadarmaExtensionsManager.tsx` (ou similar)
- Na listagem de ramais, ao sincronizar com o PBX, verificar `is_recorded` e exibir um alerta se a gravação estiver desabilitada para algum ramal ativo.

