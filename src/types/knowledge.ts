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
