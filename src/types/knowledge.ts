// Types for Product Knowledge Module

export type KnowledgeSectionTipo = 
  | 'FAQ' 
  | 'OBJECOES' 
  | 'PITCH' 
  | 'RISCOS' 
  | 'ESTRUTURA_JURIDICA' 
  | 'GERAL';

export const SECTION_LABELS: Record<KnowledgeSectionTipo, string> = {
  FAQ: 'Perguntas Frequentes',
  OBJECOES: 'Objeções e Respostas',
  PITCH: 'Pitch de Vendas',
  RISCOS: 'Riscos e Mitigações',
  ESTRUTURA_JURIDICA: 'Estrutura Jurídica',
  GERAL: 'Informações Gerais',
};

export const SECTION_ICONS: Record<KnowledgeSectionTipo, string> = {
  FAQ: '❓',
  OBJECOES: '🛡️',
  PITCH: '🎯',
  RISCOS: '⚠️',
  ESTRUTURA_JURIDICA: '⚖️',
  GERAL: '📋',
};

export const SECTION_ORDER: KnowledgeSectionTipo[] = [
  'GERAL',
  'PITCH',
  'FAQ',
  'OBJECOES',
  'RISCOS',
  'ESTRUTURA_JURIDICA',
];

export interface ProductKnowledge {
  id: string;
  empresa: 'TOKENIZA' | 'BLUE';
  produto_id: string;
  produto_nome: string;
  descricao_curta: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSection {
  id: string;
  product_knowledge_id: string;
  tipo: KnowledgeSectionTipo;
  titulo: string;
  conteudo: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  product_knowledge_id: string;
  nome_arquivo: string;
  storage_path: string;
  tipo_documento: string | null;
  descricao: string | null;
  uploaded_at: string;
}

export interface ProductKnowledgeWithSections extends ProductKnowledge {
  sections: KnowledgeSection[];
  documents: KnowledgeDocument[];
}

// Helper function to group sections by type
export function groupSectionsByType(sections: KnowledgeSection[]): Record<KnowledgeSectionTipo, KnowledgeSection[]> {
  const grouped: Record<KnowledgeSectionTipo, KnowledgeSection[]> = {
    FAQ: [],
    OBJECOES: [],
    PITCH: [],
    RISCOS: [],
    ESTRUTURA_JURIDICA: [],
    GERAL: [],
  };

  sections.forEach(section => {
    if (grouped[section.tipo]) {
      grouped[section.tipo].push(section);
    }
  });

  // Sort each group by ordem
  Object.keys(grouped).forEach(key => {
    grouped[key as KnowledgeSectionTipo].sort((a, b) => a.ordem - b.ordem);
  });

  return grouped;
}

// FAQ types
export const FAQ_CATEGORIAS = [
  'Produto',
  'Processo Interno',
  'Jurídico / Compliance',
  'Comercial / Vendas',
  'Financeiro',
  'Operacional',
  'Outros',
] as const;

export type FaqStatus = 'RASCUNHO' | 'PENDENTE' | 'APROVADO' | 'REJEITADO';
export type FaqFonte = 'MANUAL' | 'IMPORTACAO' | 'CONVERSA';

export interface KnowledgeFaq {
  id: string;
  empresa: string;
  pergunta: string;
  resposta: string;
  categoria: string | null;
  tags: string[];
  fonte: FaqFonte;
  status: FaqStatus;
  motivo_rejeicao: string | null;
  criado_por: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  produto_id: string | null;
  visivel_amelia: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  autor?: { id: string; nome: string } | null;
}

export const FAQ_STATUS_CONFIG: Record<FaqStatus, { label: string; color: string }> = {
  RASCUNHO: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  PENDENTE: { label: 'Pendente', color: 'bg-warning/10 text-warning border-warning/30' },
  APROVADO: { label: 'Aprovado', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  REJEITADO: { label: 'Rejeitado', color: 'bg-destructive/10 text-destructive border-destructive/30' },
};

// Format knowledge for SDR prompt
export function formatKnowledgeForSDR(
  product: ProductKnowledge,
  sections: KnowledgeSection[]
): string {
  const grouped = groupSectionsByType(sections);
  const parts: string[] = [];

  parts.push(`## Produto: ${product.produto_nome}`);
  if (product.descricao_curta) {
    parts.push(product.descricao_curta);
  }

  SECTION_ORDER.forEach(tipo => {
    const sectionList = grouped[tipo];
    if (sectionList.length > 0) {
      parts.push(`\n### ${SECTION_LABELS[tipo]}`);
      sectionList.forEach(section => {
        parts.push(`**${section.titulo}**`);
        parts.push(section.conteudo);
      });
    }
  });

  return parts.join('\n');
}

// Format FAQ items for SDR prompt
export function formatFaqForSDR(faqs: KnowledgeFaq[]): string {
  if (faqs.length === 0) return '';
  const parts: string[] = ['## FAQ - Base de Conhecimento\n'];
  faqs.forEach(faq => {
    parts.push(`**P: ${faq.pergunta}**`);
    parts.push(`R: ${faq.resposta}\n`);
  });
  return parts.join('\n');
}
