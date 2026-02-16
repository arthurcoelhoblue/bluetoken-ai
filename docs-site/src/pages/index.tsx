import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const profiles = [
  {
    emoji: '💼',
    title: 'Vendedor',
    description: 'Pipeline, deals, cadências, leads quentes e telefonia. Tudo para fechar mais negócios.',
    link: '/docs/vendedor/',
  },
  {
    emoji: '🤝',
    title: 'Sucesso do Cliente',
    description: 'Health Score, predição de churn, playbooks, pesquisas NPS/CSAT e briefing diário.',
    link: '/docs/cs/',
  },
  {
    emoji: '📊',
    title: 'Gestor',
    description: 'Cockpit estratégico, analytics executivo, performance de equipe e configuração de funis.',
    link: '/docs/gestor/',
  },
  {
    emoji: '⚙️',
    title: 'Administrador',
    description: 'IA, base de conhecimento, custos, integrações, importação e saúde operacional.',
    link: '/docs/admin/',
  },
  {
    emoji: '🛠️',
    title: 'Desenvolvedor',
    description: 'Arquitetura, Edge Functions, RLS, multi-tenancy, SDR-IA e referência de APIs.',
    link: '/docs/desenvolvedor/',
  },
];

export default function Home(): React.JSX.Element {
  return (
    <Layout title="Documentação" description="Manual prático do Amélia CRM para todos os perfis">
      <header className="hero hero--primary" style={{padding: '4rem 0', textAlign: 'center'}}>
        <div className="container">
          <h1 style={{color: '#fff', fontSize: '2.5rem', marginBottom: '0.5rem'}}>
            📘 Documentação do Amélia CRM
          </h1>
          <p style={{color: 'rgba(255,255,255,0.9)', fontSize: '1.25rem', maxWidth: 600, margin: '0 auto'}}>
            Manual prático e completo. Escolha seu perfil para começar.
          </p>
          <div style={{marginTop: '1.5rem'}}>
            <Link className="button button--secondary button--lg" to="/docs/guia-rapido">
              🚀 Guia Rápido — Comece Aqui
            </Link>
          </div>
        </div>
      </header>

      <main className="container" style={{padding: '3rem 0'}}>
        <div className="profile-cards">
          {profiles.map((p) => (
            <Link key={p.title} to={p.link} className="profile-card">
              <span className="emoji">{p.emoji}</span>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
