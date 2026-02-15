// ========================================
// _shared/business-hours.ts — Horário comercial BRT (UTC-3)
// ========================================

/**
 * Retorna a data/hora atual em horário de Brasília (UTC-3)
 */
export function getHorarioBrasilia(): Date {
  const now = new Date();
  const brasiliaOffset = -3 * 60; // minutos
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + brasiliaOffset * 60 * 1000);
}

/**
 * Verifica se o horário atual é comercial: Seg-Sex 09h-18h BRT
 */
export function isHorarioComercial(): boolean {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay(); // 0=dom, 1=seg, ..., 5=sex, 6=sab
  const hora = brasilia.getHours();
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18;
}

/**
 * Calcula o próximo horário comercial (09:00 BRT do próximo dia útil)
 * Retorna em UTC para uso direto no banco
 */
export function proximoHorarioComercial(): Date {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay();
  const hora = brasilia.getHours();

  let diasParaAdicionar = 0;

  if (dia >= 1 && dia <= 5 && hora < 9) {
    // Dia útil antes das 9h → hoje às 09:00
    diasParaAdicionar = 0;
  } else if (dia === 5 && hora >= 18) {
    // Sexta após 18h → segunda
    diasParaAdicionar = 3;
  } else if (dia === 6) {
    // Sábado → segunda
    diasParaAdicionar = 2;
  } else if (dia === 0) {
    // Domingo → segunda
    diasParaAdicionar = 1;
  } else if (dia >= 1 && dia <= 4 && hora >= 18) {
    // Seg-Qui após 18h → amanhã
    diasParaAdicionar = 1;
  }

  // Construir data em BRT que corresponda a 09:00
  const resultado = new Date(brasilia);
  resultado.setDate(resultado.getDate() + diasParaAdicionar);
  resultado.setHours(9, 0, 0, 0);

  // Converter de volta para UTC: 09:00 BRT = 12:00 UTC
  const utcMs = resultado.getTime() - (-3 * 60) * 60 * 1000;
  return new Date(utcMs);
}
