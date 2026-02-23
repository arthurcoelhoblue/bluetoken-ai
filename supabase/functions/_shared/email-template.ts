// ========================================
// _shared/email-template.ts — Wrapper HTML profissional para e-mails de cadência
// ========================================

import type { EmpresaTipo } from './types.ts';

// ========================================
// Brand config por empresa
// ========================================
interface BrandConfig {
  name: string;
  primaryColor: string;
  accentColor: string;
  headerBg: string;
  ctaColor: string;
  domain: string;
  sdrName: string;
  sdrTitle: string;
}

const BRAND: Record<string, BrandConfig> = {
  BLUE: {
    name: 'Blue Consult',
    primaryColor: '#1a365d',
    accentColor: '#2b6cb0',
    headerBg: '#1a365d',
    ctaColor: '#2b6cb0',
    domain: 'grupoblue.com.br',
    sdrName: 'Amélia',
    sdrTitle: 'SDR Blue Consult',
  },
  TOKENIZA: {
    name: 'Tokeniza',
    primaryColor: '#1a5632',
    accentColor: '#c8a415',
    headerBg: '#1a5632',
    ctaColor: '#c8a415',
    domain: 'tokeniza.com.br',
    sdrName: 'Amélia',
    sdrTitle: 'SDR Tokeniza',
  },
};

function getBrand(empresa: string): BrandConfig {
  return BRAND[empresa] || BRAND.BLUE;
}

// ========================================
// Parsing helpers
// ========================================

/** Converte **texto** em <strong> */
function parseBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/** Detecta se o conteúdo já é HTML (começa com tag) */
function isHtml(content: string): boolean {
  return /^\s*<[a-z!]/i.test(content);
}

/** Detecta linhas de CTA (convites de agendamento) */
function detectCta(content: string): { text: string; url: string } | null {
  // Procura padrões como "Agende" ou "agendar conversa" com link
  const linkMatch = content.match(/\[([^\]]*(?:agend|convers|reuni|bate-papo|call)[^\]]*)\]\((https?:\/\/[^)]+)\)/i);
  if (linkMatch) return { text: linkMatch[1], url: linkMatch[2] };

  // Procura URL solo perto de palavras de agendamento
  const urlMatch = content.match(/(https?:\/\/(?:calendly\.com|cal\.com|tidycal\.com|meet\.google\.com)[^\s<)"']+)/i);
  if (urlMatch) return { text: 'Agendar conversa', url: urlMatch[1] };

  return null;
}

/** Converte conteúdo de texto puro em HTML formatado */
function textToHtml(content: string, brand: BrandConfig): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Linha vazia
    if (!trimmed) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<br>');
      continue;
    }

    // Bullet point (• ou - no início)
    if (/^[•\-–]\s+/.test(trimmed)) {
      if (!inList) { result.push('<ul style="margin:8px 0 8px 0;padding-left:20px;color:#334155;">'); inList = true; }
      const itemText = parseBold(trimmed.replace(/^[•\-–]\s+/, ''));
      result.push(`<li style="margin-bottom:4px;line-height:1.6;">${itemText}</li>`);
      continue;
    }

    // Fechar lista se aberta
    if (inList) { result.push('</ul>'); inList = false; }

    // Linha normal
    result.push(`<p style="margin:0 0 10px 0;line-height:1.7;color:#334155;">${parseBold(trimmed)}</p>`);
  }

  if (inList) result.push('</ul>');
  return result.join('\n');
}

// ========================================
// Wrapper principal
// ========================================

export function wrapEmailHtml(
  content: string,
  empresa: EmpresaTipo | string,
  leadNome?: string | null,
): string {
  const brand = getBrand(empresa as string);
  const cta = detectCta(content);

  // Se já é HTML, aplica só o envelope externo
  const bodyHtml = isHtml(content) ? content : textToHtml(content, brand);

  // Remove link de CTA do body se vamos renderizar botão separado
  let cleanBody = bodyHtml;
  if (cta) {
    // Remove markdown links de agendamento do body para não duplicar
    cleanBody = cleanBody.replace(/\[([^\]]*(?:agend|convers|reuni|bate-papo|call)[^\]]*)\]\([^)]+\)/gi, '');
  }

  const ctaHtml = cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
      <tr>
        <td align="center" style="background-color:${brand.ctaColor};border-radius:6px;">
          <a href="${cta.url}" target="_blank" 
             style="display:inline-block;padding:12px 28px;color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">
            ${cta.text}
          </a>
        </td>
      </tr>
    </table>` : '';

  const greeting = leadNome ? `Olá ${leadNome},` : '';
  const greetingHtml = greeting ? `<p style="margin:0 0 16px 0;font-size:16px;color:#1e293b;font-weight:500;">${greeting}</p>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${brand.name}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif !important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!-- Email container 600px -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          
          <!-- Header bar -->
          <tr>
            <td style="background-color:${brand.headerBg};padding:20px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${brand.name}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:32px 32px 24px 32px;font-size:15px;line-height:1.7;color:#334155;">
              ${greetingHtml}
              ${cleanBody}
              ${ctaHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
            </td>
          </tr>

          <!-- Footer / Signature -->
          <tr>
            <td style="padding:20px 32px 24px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:16px;vertical-align:top;">
                    <!-- Avatar circle -->
                    <div style="width:40px;height:40px;border-radius:50%;background-color:${brand.accentColor};display:inline-block;text-align:center;line-height:40px;color:#ffffff;font-size:16px;font-weight:700;">A</div>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:${brand.primaryColor};">${brand.sdrName}</p>
                    <p style="margin:2px 0 0 0;font-size:12px;color:#64748b;">${brand.sdrTitle}</p>
                    <p style="margin:4px 0 0 0;">
                      <a href="https://${brand.domain}" style="font-size:12px;color:${brand.accentColor};text-decoration:none;">${brand.domain}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Unsubscribe / legal micro text -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:16px 0 0 0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} ${brand.name} &middot; Todos os direitos reservados
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
