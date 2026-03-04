import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Copy, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DealProduct } from '@/hooks/useDealProducts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: DealProduct[];
  dealTitulo?: string;
  contactNome?: string;
  contactEmail?: string;
  organizationNome?: string;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function DealProposalGenerator({ open, onOpenChange, products, dealTitulo, contactNome, contactEmail, organizationNome }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const total = products.reduce((sum, p) => sum + (p.subtotal ?? 0), 0);
  const totalDesconto = products.reduce((sum, p) => {
    const bruto = p.preco_unitario * p.quantidade;
    return sum + (bruto - (p.subtotal ?? bruto));
  }, 0);

  const handleCopy = async () => {
    const lines: string[] = [];
    lines.push('PROPOSTA COMERCIAL');
    lines.push('═'.repeat(40));
    if (organizationNome) lines.push(`Empresa: ${organizationNome}`);
    if (contactNome) lines.push(`Contato: ${contactNome}`);
    if (contactEmail) lines.push(`Email: ${contactEmail}`);
    lines.push(`Data: ${formatDate(new Date())}`);
    if (dealTitulo) lines.push(`Ref: ${dealTitulo}`);
    lines.push('');
    lines.push('ITENS');
    lines.push('─'.repeat(40));
    products.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.nome}`);
      lines.push(`   ${formatBRL(p.preco_unitario)} × ${p.quantidade}${p.desconto > 0 ? ` (-${p.desconto}%)` : ''} = ${formatBRL(p.subtotal)}`);
    });
    lines.push('─'.repeat(40));
    if (totalDesconto > 0) lines.push(`Desconto total: -${formatBRL(totalDesconto)}`);
    lines.push(`TOTAL: ${formatBRL(total)}`);
    lines.push('');
    lines.push('Proposta válida por 15 dias.');

    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Proposta copiada para a área de transferência');
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Proposta Comercial</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { text-align: left; border-bottom: 2px solid #333; padding: 8px 4px; font-size: 13px; }
        td { padding: 8px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
        .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 15px; }
        .footer { margin-top: 30px; font-size: 12px; color: #888; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Proposta Comercial
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef}>
          <h1 style={{ fontSize: '20px', borderBottom: '2px solid currentColor', paddingBottom: '8px', marginBottom: '12px' }}>
            Proposta Comercial
          </h1>
          <div style={{ marginBottom: '16px', fontSize: '13px' }} className="text-muted-foreground space-y-0.5">
            {organizationNome && <p><strong>Empresa:</strong> {organizationNome}</p>}
            {contactNome && <p><strong>Contato:</strong> {contactNome}</p>}
            {contactEmail && <p><strong>Email:</strong> {contactEmail}</p>}
            <p><strong>Data:</strong> {formatDate(new Date())}</p>
            {dealTitulo && <p><strong>Referência:</strong> {dealTitulo}</p>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold pb-2 border-b-2 border-foreground/20">Item</th>
                <th className="text-right text-xs font-semibold pb-2 border-b-2 border-foreground/20">Preço Unit.</th>
                <th className="text-center text-xs font-semibold pb-2 border-b-2 border-foreground/20">Qtd</th>
                <th className="text-center text-xs font-semibold pb-2 border-b-2 border-foreground/20">Desc.</th>
                <th className="text-right text-xs font-semibold pb-2 border-b-2 border-foreground/20">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-sm py-2 border-b border-border">{p.nome}</td>
                  <td className="text-sm py-2 border-b border-border text-right">{formatBRL(p.preco_unitario)}</td>
                  <td className="text-sm py-2 border-b border-border text-center">{p.quantidade}</td>
                  <td className="text-sm py-2 border-b border-border text-center">{p.desconto > 0 ? `${p.desconto}%` : '—'}</td>
                  <td className="text-sm py-2 border-b border-border text-right font-medium">{formatBRL(p.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {totalDesconto > 0 && (
                <tr>
                  <td colSpan={4} className="text-sm py-2 text-right text-muted-foreground">Economia total:</td>
                  <td className="text-sm py-2 text-right text-green-600 font-medium">-{formatBRL(totalDesconto)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="text-base py-3 text-right font-bold border-t-2 border-foreground/20">Total:</td>
                <td className="text-base py-3 text-right font-bold border-t-2 border-foreground/20">{formatBRL(total)}</td>
              </tr>
            </tfoot>
          </table>

          <p style={{ marginTop: '24px', fontSize: '12px' }} className="text-muted-foreground">
            Proposta válida por 15 dias a partir da data de emissão.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1.5" /> Copiar texto
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
