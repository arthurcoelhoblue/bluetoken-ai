import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ─── Brand Colors ────────────────────────────────────────────────────────────
const COLORS = {
  deepTeal: '#0B4B4B',
  tealPrimary: '#379C8B',
  vividMint: '#5FC0A5',
  lightMint: '#BCE9D9',
  darkSlate: '#2B3946',
  pureWhite: '#FFFFFF',
};

// ─── Logo path (relative to public/) ─────────────────────────────────────────
const LOGO_SRC = '/images/brand/amelia-logo.png';
const LOGO_SMALL_SRC = '/images/brand/amelia-logo-small.jpg';
const ICON_SRC = '/images/brand/amelia-icon-192.png';

// ─── Reveal on Scroll Hook ──────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#personas', label: 'Para quem' },
    { href: '#brain', label: 'Como funciona' },
    { href: '#features', label: 'Funcionalidades' },
    { href: '#comparison', label: 'Comparativo' },
    { href: '#pricing', label: 'Preços' },
  ];

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '16px 0',
        background: scrolled ? 'rgba(255,255,255,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(11,75,75,0.08)' : 'none',
        boxShadow: scrolled ? '0 4px 30px rgba(11,75,75,0.06)' : 'none',
        transition: 'all 0.4s ease',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: '1.25rem', color: COLORS.darkSlate }}>
          <img src={ICON_SRC} alt="Amélia CRM" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <span style={{ color: COLORS.tealPrimary, fontWeight: 800 }}>amélia</span>CRM
        </a>

        {/* Desktop links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none', margin: 0, padding: 0 }} className="nav-links-desktop">
          {links.map(l => (
            <li key={l.href}>
              <a href={l.href} style={{ textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, color: COLORS.darkSlate, opacity: 0.75 }}>{l.label}</a>
            </li>
          ))}
          <li>
            <Link to="/auth" style={{
              textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, color: COLORS.darkSlate, opacity: 0.75,
            }}>Entrar</Link>
          </li>
          <li>
            <a href="#demo" style={{
              display: 'inline-flex', alignItems: 'center', padding: '10px 22px', borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
              color: 'white', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(55,156,139,0.3)',
            }}>Agendar Demo</a>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="nav-mobile-toggle" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.darkSlate} strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" style={{
      position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '120px 24px 80px', overflow: 'hidden',
      background: `radial-gradient(ellipse at 50% 0%, rgba(188,233,217,0.35) 0%, rgba(255,255,255,0) 70%), radial-gradient(ellipse at 80% 80%, rgba(95,192,165,0.1) 0%, transparent 50%), ${COLORS.pureWhite}`,
    }}>
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 800 }}>
        <Reveal>
          <div style={{ width: 160, height: 160, margin: '0 auto 32px', animation: 'float 6s ease-in-out infinite', filter: 'drop-shadow(0 20px 40px rgba(55,156,139,0.2))' }}>
            <img src={LOGO_SRC} alt="Amélia CRM" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div style={{
            display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '6px 16px', borderRadius: 100, background: 'rgba(55,156,139,0.1)', color: COLORS.tealPrimary, marginBottom: 16,
          }}>CRM com Inteligência Artificial Integrada</div>
        </Reveal>
        <Reveal delay={0.2}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24,
            background: `linear-gradient(135deg, ${COLORS.darkSlate} 0%, ${COLORS.deepTeal} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Seu time vende.<br />
            <span style={{
              background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>A Amélia faz todo o resto.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.3}>
          <p style={{ fontSize: '1.2rem', lineHeight: 1.8, color: '#5a6b7a', maxWidth: 600, margin: '0 auto 40px' }}>
            De lead frio a reunião agendada — sem intervenção humana. A Amélia qualifica, aborda e converte automaticamente pelo WhatsApp, Email e Telefone enquanto seu time foca em fechar negócios.
          </p>
        </Reveal>
        <Reveal delay={0.4}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 48, flexWrap: 'wrap' }}>
            <a href="#demo" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
              color: 'white', fontWeight: 600, fontSize: '1rem', textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(55,156,139,0.3)',
            }}>Agendar Demo Gratuita →</a>
            <a href="#brain" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12,
              background: 'rgba(55,156,139,0.08)', color: COLORS.tealPrimary, fontWeight: 600, fontSize: '1rem',
              textDecoration: 'none', border: '1.5px solid rgba(55,156,139,0.2)',
            }}>Ver como funciona</a>
          </div>
        </Reveal>
        <Reveal delay={0.5}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, fontSize: '0.85rem', color: '#8a9baa' }}>
            <span>+200 empresas confiam na Amélia</span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#ccc' }}></span>
            <span>⭐ 4.9/5 de satisfação</span>
          </div>
        </Reveal>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        color: COLORS.tealPrimary, fontSize: '0.8rem', fontWeight: 500, opacity: 0.7,
        animation: 'scrollBounce 2s ease-in-out infinite',
      }}>
        Scroll para mergulhar
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
      </div>
    </section>
  );
}

// ─── Personas ────────────────────────────────────────────────────────────────
const personas = [
  { icon: '📊', title: 'Diretor Comercial', quote: '"Cansei de depender de feeling. Quero previsibilidade no pipeline e dados reais de conversão."', answer: 'A Amélia entrega <strong>analytics em tempo real</strong>, funil transparente e projeção de receita para decisões baseadas em dados.' },
  { icon: '🎯', title: 'Head de Vendas / SDR', quote: '"Meu time gasta 70% do tempo em tarefas operacionais em vez de vender."', answer: 'A Amélia assume <strong>follow-up, qualificação e agendamento</strong>. Seu time só faz o que importa: fechar.' },
  { icon: '🚀', title: 'CEO / Fundador', quote: '"Preciso escalar vendas sem triplicar a equipe."', answer: 'A Amélia é uma <strong>SDR que trabalha 24/7</strong>, não tira férias e custa uma fração de um salário.' },
];

function Personas() {
  return (
    <section id="personas" style={{ padding: '120px 0', background: 'linear-gradient(180deg, #fff 0%, #f7fcfa 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="tag">Para quem é</div>
            <h2 className="section-title">Se você se identifica, a Amélia<br />foi feita para você.</h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28 }}>
          {personas.map((p, i) => (
            <Reveal key={i} delay={0.1 * (i + 1)}>
              <div className="persona-card">
                <div className="persona-icon">{p.icon}</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12, color: COLORS.darkSlate }}>{p.title}</h3>
                <p style={{
                  fontSize: '0.95rem', lineHeight: 1.65, color: '#5a6b7a', fontStyle: 'italic',
                  marginBottom: 20, paddingLeft: 16, borderLeft: `3px solid ${COLORS.lightMint}`,
                }}>{p.quote}</p>
                <div style={{
                  fontSize: '0.9rem', lineHeight: 1.6, color: COLORS.darkSlate,
                  padding: 16, background: 'rgba(188,233,217,0.15)', borderRadius: 12,
                }} dangerouslySetInnerHTML={{ __html: p.answer }} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Brain Steps ─────────────────────────────────────────────────────────────
const brainSteps = [
  { step: '1/4', badge: 'RAG + Embeddings', title: 'Absorve seu conhecimento', desc: 'Você alimenta com playbooks, scripts e informações do produto. A Amélia estuda tudo e entende seu mercado, concorrentes e objeções.' },
  { step: '2/4', badge: 'Machine Learning', title: 'Analisa cada lead', desc: 'Cruza dados do contato com o que aprendeu. Identifica quem tem perfil ideal, quem está quente e quem precisa de mais nutrição.' },
  { step: '3/4', badge: 'Decision Engine', title: 'Escolhe a melhor abordagem', desc: 'Decide o canal certo, o melhor horário e a mensagem ideal. Aplica SPIN Selling e BANT automaticamente.' },
  { step: '4/4', badge: 'Auto-pilot', title: 'Age sem esperar comando', desc: 'Envia a primeira mensagem, faz follow-up, responde objeções e agenda a reunião no calendário do vendedor. Tudo sozinha, 24h por dia.' },
];

function BrainSection() {
  return (
    <section id="brain" style={{
      padding: '120px 0', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0B2E2E 0%, #0B4B4B 40%, #1a5c5c 100%)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 72, position: 'relative', zIndex: 2 }}>
            <div className="tag tag-light">Dentro das sinapses da IA</div>
            <h2 className="section-title" style={{ color: 'white' }}>Não é automação burra.<br />É inteligência de verdade.</h2>
            <p style={{ fontSize: '1.125rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', maxWidth: 640, margin: '0 auto' }}>
              A Amélia não segue scripts fixos. Ela aprende, interpreta contexto e toma decisões como seu melhor vendedor faria.
            </p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, position: 'relative', zIndex: 2 }}>
          {brainSteps.map((s, i) => (
            <Reveal key={i} delay={0.1 * (i + 1)}>
              <div className="brain-step">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLORS.vividMint, marginBottom: 8 }}>
                  Passo {s.step}
                  <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(95,192,165,0.15)', color: COLORS.vividMint, fontSize: '0.65rem', fontWeight: 600 }}>{s.badge}</span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: 12, marginTop: 12 }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.6)' }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Chat Simulation ─────────────────────────────────────────────────────────
const chatMessages = [
  { type: 'lead' as const, text: 'Quanto custa o plano empresarial?', delay: 800 },
  { type: 'ai' as const, text: 'Oi, Ricardo! 😊 O plano empresarial começa em R$180/usuário. Posso agendar 15 min com nosso consultor para montar uma proposta personalizada para a TechSolutions?', delay: 2000 },
  { type: 'lead' as const, text: 'Pode ser amanhã às 14h', delay: 3500 },
  { type: 'ai' as const, text: 'Perfeito! ✅ Agendado para amanhã às 14h. O Rafael vai te atender. Enviei a confirmação no seu email. 🚀', delay: 5000 },
  { type: 'result' as const, text: '📅 Reunião agendada automaticamente no Google Calendar do vendedor', delay: 6500 },
];

function ChatSimulation() {
  const [visibleMsgs, setVisibleMsgs] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) {
        setStarted(true);
        chatMessages.forEach((msg, i) => {
          setTimeout(() => setVisibleMsgs(prev => [...prev, i]), msg.delay);
        });
      }
    }, { threshold: 0.5 });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [started]);

  return (
    <div ref={containerRef} style={{
      maxWidth: 500, margin: '0 auto', background: COLORS.pureWhite, borderRadius: 24,
      boxShadow: '0 20px 60px rgba(11,75,75,0.1)', overflow: 'hidden', border: '1px solid rgba(11,75,75,0.06)',
    }}>
      <div style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12,
        background: `linear-gradient(135deg, ${COLORS.deepTeal}, ${COLORS.tealPrimary})`, color: 'white',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>A</div>
        <div><div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Amélia IA</div><div style={{ fontSize: '0.7rem', opacity: 0.7 }}>● Online agora</div></div>
      </div>
      <div style={{ padding: 24, minHeight: 280 }}>
        {visibleMsgs.map(idx => {
          const msg = chatMessages[idx];
          if (msg.type === 'result') {
            return (
              <div key={idx} style={{
                marginTop: 12, padding: '12px 16px', background: 'rgba(55,156,139,0.06)', borderRadius: 12,
                borderLeft: `3px solid ${COLORS.vividMint}`, fontSize: '0.8rem', color: COLORS.tealPrimary, fontWeight: 500,
                animation: 'fadeInUp 0.5s ease',
              }}>{msg.text}</div>
            );
          }
          const isLead = msg.type === 'lead';
          return (
            <div key={idx} style={{ marginBottom: 16, display: 'flex', justifyContent: isLead ? 'flex-end' : 'flex-start', animation: 'fadeInUp 0.5s ease' }}>
              <div style={{
                maxWidth: '80%', padding: '12px 16px', borderRadius: 16, fontSize: '0.85rem', lineHeight: 1.55,
                background: isLead ? '#e8f5f0' : `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
                color: isLead ? COLORS.darkSlate : 'white',
                borderBottomRightRadius: isLead ? 4 : 16,
                borderBottomLeftRadius: isLead ? 16 : 4,
              }}>{msg.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '16px 24px', background: '#f9fdfb', borderTop: '1px solid #eef5f1' }}>
        {[{ val: '24/7', label: 'Disponível' }, { val: '847', label: 'Leads/mês' }, { val: '92%', label: 'Agendamento' }].map((m, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: COLORS.tealPrimary }}>{m.val}</div>
            <div style={{ fontSize: '0.7rem', color: '#8a9baa', marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Platform Section ────────────────────────────────────────────────────────
function PlatformSection() {
  const tools = ['CRM', 'Chat', 'Email', 'Telefone', 'Agenda', 'CS'];
  const benefits = [
    'Nenhum lead fica sem resposta — follow-up automático por WhatsApp, email e telefone',
    'Seu vendedor nunca mais esquece um follow-up — cadências inteligentes cuidam disso',
    'Sem alt-tab: a conversa com o lead acontece dentro do CRM',
    'Dados de todos os canais em um só lugar — chega de planilha paralela',
  ];

  return (
    <section id="platform" style={{ padding: '120px 0', background: 'linear-gradient(180deg, #f7fcfa 0%, #fff 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="tag">Tudo em um lugar</div>
            <h2 className="section-title">6 ferramentas. 6 logins. 6 faturas.<br />Ou a Amélia.</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>
              Nos outros CRMs, você precisa de ferramentas separadas. Na Amélia, é tudo integrado — inclusive a conversa com o lead.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 40, alignItems: 'center', marginBottom: 72 }} className="platform-compare-grid">
            <div style={{ padding: 40, borderRadius: 24, background: '#fafafa', border: '1px solid #eee' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#8a9baa', marginBottom: 24 }}>Sem a Amélia</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {tools.map(t => (
                  <span key={t} style={{ padding: '8px 16px', borderRadius: 10, background: '#fff', border: '1px solid #e0e0e0', fontSize: '0.85rem', color: '#888' }}>{t}</span>
                ))}
              </div>
              <p style={{ fontSize: '0.85rem', color: '#b44', fontWeight: 500 }}>6 logins · Dados fragmentados · +R$ 3.000/mês</p>
            </div>

            <div style={{
              width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '0.8rem',
              boxShadow: '0 8px 30px rgba(55,156,139,0.3)',
            }}>VS</div>

            <div style={{
              padding: 40, borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(55,156,139,0.04), rgba(95,192,165,0.08))',
              border: '1.5px solid rgba(55,156,139,0.15)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})` }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.tealPrimary, marginBottom: 24 }}>Com a Amélia — Tudo em um</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {benefits.map((b, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, fontSize: '0.95rem', lineHeight: 1.5, color: COLORS.darkSlate }}>
                    <span style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 700, marginTop: 2,
                    }}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <ChatSimulation />
        </Reveal>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
const features = [
  { icon: '💬', title: 'Cadências Multi-canal', desc: 'Follow-up automático por WhatsApp, email e telefone. Nenhum lead cai no esquecimento.' },
  { icon: '⚡', title: 'Fluxos Inteligentes', desc: 'Automações drag-and-drop com condições e gatilhos. Monte em minutos, rode para sempre.' },
  { icon: '📨', title: 'Disparos em Massa', desc: 'Campanhas segmentadas com personalização por IA. Cada mensagem parece escrita à mão.' },
  { icon: '🔥', title: 'Scoring Automático', desc: 'Saiba quais leads estão prontos para comprar antes do vendedor ligar.' },
  { icon: '📋', title: 'Pipeline Visual', desc: 'Kanban drag-and-drop com visão 360° de cada deal. Nada escapa do funil.' },
  { icon: '👥', title: 'Gestão de Equipe', desc: 'Distribuição automática de leads, metas e comissões. Transparência total.' },
  { icon: '📊', title: 'Analytics Real-time', desc: 'Dashboards com métricas de conversão, receita e performance. Decisão com dados, não achismo.' },
  { icon: '🏆', title: 'Gamificação', desc: 'Rankings, badges e comissões automáticas. Seu time compete e performa mais.' },
  { icon: '💚', title: 'Customer Success', desc: 'Health Score, NPS e playbooks de retenção. Reduza churn antes que ele aconteça.' },
];

const metrics = [
  { val: '+40%', label: 'Aumento na conversão' },
  { val: 'R$ 3.200', label: 'Economia mensal' },
  { val: '24/7', label: 'IA trabalhando por você' },
  { val: '85%', label: 'Leads qualificados automaticamente' },
];

function FeaturesSection() {
  return (
    <section id="features" style={{
      padding: '120px 0', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0B2E2E 0%, #0B4B4B 40%, #1a5c5c 100%)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64, position: 'relative', zIndex: 2 }}>
            <div className="tag tag-light">O que está por baixo do capô</div>
            <h2 className="section-title" style={{ color: 'white' }}>Zero trabalho manual.<br />Máxima conversão.</h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 72, position: 'relative', zIndex: 2 }}>
          {features.map((f, i) => (
            <Reveal key={i} delay={0.1 * ((i % 3) + 1)}>
              <div className="feature-card">
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 20, fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, rgba(95,192,165,0.2), rgba(55,156,139,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{f.icon}</div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white', marginBottom: 8 }}>{f.title}</h4>
                <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.55)' }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, position: 'relative', zIndex: 2 }}>
          {metrics.map((m, i) => (
            <Reveal key={i} delay={0.1 * (i + 1)}>
              <div style={{
                textAlign: 'center', padding: '32px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{
                  fontSize: '2.5rem', fontWeight: 800,
                  background: `linear-gradient(135deg, ${COLORS.vividMint}, ${COLORS.lightMint})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{m.val}</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{m.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison Table ────────────────────────────────────────────────────────
const comparisonRows = [
  { label: 'Por usuário/mês', amelia: 'R$ 180', pipedrive: 'R$ 384', hubspot: 'R$ 600', salesforce: 'R$ 1.050' },
  { label: 'Equipe de 5', amelia: 'R$ 1.719/mês', pipedrive: 'R$ 1.920/mês', hubspot: 'R$ 3.000/mês', salesforce: 'R$ 5.250/mês' },
  { label: 'Implantação', amelia: 'R$ 0', pipedrive: 'R$ 0', hubspot: 'R$ 9.000', salesforce: 'R$ 30.000+' },
  { label: 'SDR com IA', amelia: 'exclusive', pipedrive: false, hubspot: false, salesforce: false },
  { label: 'Customer Success', amelia: 'exclusive', pipedrive: false, hubspot: false, salesforce: false },
  { label: 'Gamificação', amelia: 'exclusive', pipedrive: false, hubspot: false, salesforce: false },
  { label: 'WhatsApp Business API', amelia: 'exclusive', pipedrive: false, hubspot: false, salesforce: false },
  { label: 'Telefonia Nativa', amelia: true, pipedrive: false, hubspot: false, salesforce: true },
  { label: 'Google Calendar c/ IA', amelia: true, pipedrive: false, hubspot: false, salesforce: false },
];

function renderCell(val: string | boolean) {
  if (val === 'exclusive') return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 100, background: 'rgba(55,156,139,0.1)', color: COLORS.tealPrimary, fontSize: '0.7rem', fontWeight: 700 }}>✓ Exclusivo</span>;
  if (val === true) return <span style={{ color: COLORS.vividMint, fontWeight: 700 }}>✓</span>;
  if (val === false) return <span style={{ color: '#ccc' }}>✗</span>;
  return val;
}

function ComparisonSection() {
  return (
    <section id="comparison" style={{ padding: '120px 0', background: 'linear-gradient(180deg, #fff 0%, #f7fcfa 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="tag">Comparativo real</div>
            <h2 className="section-title">Mais funcionalidades.<br />Uma fração do preço.</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>Comparamos com os maiores CRMs do mercado. Veja por que migrar para a Amélia é uma decisão óbvia.</p>
          </div>
        </Reveal>
        <Reveal>
          <div style={{ overflowX: 'auto', borderRadius: 24, boxShadow: '0 8px 40px rgba(11,75,75,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: COLORS.pureWhite, fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '24px 20px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #f0f0f0' }}></th>
                  <th style={{
                    padding: '24px 20px', textAlign: 'center', fontWeight: 600,
                    background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
                    color: 'white', borderRadius: '16px 16px 0 0', position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                      padding: '3px 14px', borderRadius: 100, background: COLORS.deepTeal,
                      color: COLORS.lightMint, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>★ Recomendado</span>
                    Amélia CRM
                  </th>
                  <th style={{ padding: '24px 20px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #f0f0f0' }}>Pipedrive</th>
                  <th style={{ padding: '24px 20px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #f0f0f0' }}>HubSpot</th>
                  <th style={{ padding: '24px 20px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid #f0f0f0' }}>Salesforce</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 500, borderBottom: '1px solid #f5f5f5' }}>{row.label}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f5f5f5', background: 'rgba(55,156,139,0.03)', fontWeight: 700, color: COLORS.tealPrimary }}>{renderCell(row.amelia)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f5f5f5' }}>{renderCell(row.pipedrive)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f5f5f5' }}>{renderCell(row.hubspot)}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid #f5f5f5' }}>{renderCell(row.salesforce)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <a href="#demo" className="btn-primary">Migre para a Amélia →</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Proof Section ───────────────────────────────────────────────────────────
function ProofSection() {
  return (
    <section id="proof" style={{
      padding: '120px 0', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0B2E2E 0%, #0B4B4B 40%, #1a5c5c 100%)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="tag tag-light">Resultados reais</div>
            <h2 className="section-title" style={{ color: 'white' }}>Números, não promessas.</h2>
          </div>
        </Reveal>
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 100,
              background: 'rgba(95,192,165,0.1)', border: '1px solid rgba(95,192,165,0.2)',
              color: COLORS.vividMint, fontWeight: 600, fontSize: '0.95rem', marginBottom: 32,
            }}>🚀 Programa Piloto — Condições exclusivas</div>
            <p style={{ fontSize: '1.2rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)', marginBottom: 40 }}>
              Seja uma das primeiras empresas a experimentar o poder da Amélia. Estamos selecionando empresas para nosso{' '}
              <em style={{ fontStyle: 'normal', color: COLORS.vividMint, fontWeight: 600 }}>programa piloto com condições exclusivas</em> de early-adopter. Vagas limitadas.
            </p>
            <a href="#demo" style={{
              display: 'inline-flex', alignItems: 'center', padding: '14px 32px', borderRadius: 12,
              background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)',
              color: 'white', fontWeight: 600, fontSize: '1rem', textDecoration: 'none',
            }}>Quero participar do piloto →</a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing Section ─────────────────────────────────────────────────────────
const pricingFeatures = [
  'Pipeline visual com Kanban drag-and-drop', 'SDR com Inteligência Artificial', 'WhatsApp Business API integrado',
  'Email profissional integrado', 'Telefonia com gravação e transcrição', 'Google Calendar com agendamento automático',
  'Customer Success com Health Score', 'Gamificação, rankings e metas', 'Analytics e dashboards em tempo real',
  'Base de conhecimento com IA (RAG)', 'Cadências automatizadas multicanal', 'Importação de leads e integrações',
];

function PricingSection() {
  return (
    <section id="pricing" style={{ padding: '120px 0', background: 'linear-gradient(180deg, #fff 0%, #f7fcfa 100%)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="tag">Preço transparente</div>
            <h2 className="section-title">Um preço. Tudo incluso.<br />Sem surpresas.</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>Sem planos confusos. Todas as funcionalidades liberadas desde o dia 1.</p>
          </div>
        </Reveal>
        <Reveal>
          <div style={{
            maxWidth: 640, margin: '0 auto', padding: 48, borderRadius: 28, background: COLORS.pureWhite,
            border: '1.5px solid rgba(55,156,139,0.15)', boxShadow: '0 20px 60px rgba(11,75,75,0.08)',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})` }} />
            <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.tealPrimary, marginBottom: 8 }}>Plano Completo</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.darkSlate }}>R$</span>
              <span style={{ fontSize: '4rem', fontWeight: 800, color: COLORS.darkSlate, lineHeight: 1 }}>180</span>
              <span style={{ fontSize: '1rem', color: '#8a9baa', fontWeight: 500 }}>/usuário/mês</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#8a9baa', marginBottom: 32 }}>Plano base R$999/mês inclui 1 usuário. Cada adicional: R$180/mês.</p>
            <ul style={{ listStyle: 'none', textAlign: 'left', marginBottom: 36, padding: 0 }}>
              {pricingFeatures.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', fontSize: '0.9rem', color: COLORS.darkSlate, borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 700,
                  }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a href="#demo" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 16, fontSize: '1.05rem', borderRadius: 14 }}>Agendar Demo Gratuita →</a>
            <p style={{ marginTop: 20, fontSize: '0.8rem', color: '#8a9baa' }}>Sem taxa de implantação · Sem contrato de fidelidade · Cancele quando quiser</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Demo Form ───────────────────────────────────────────────────────────────
function DemoSection() {
  return (
    <section id="demo" style={{
      padding: '120px 0', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0B2E2E 0%, #0B4B4B 40%, #1a5c5c 100%)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 64, alignItems: 'center' }}>
          <Reveal>
            <div style={{ color: 'white' }}>
              <div className="tag tag-light">Veja na prática</div>
              <h2 className="section-title" style={{ color: 'white' }}>30 minutos que podem mudar sua operação comercial.</h2>
              <p style={{ fontSize: '1.125rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
                Demonstração personalizada com simulação real usando seus dados. Sem compromisso, sem cartão.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 32 }}>
                {[
                  { icon: '🎯', text: 'Demo personalizada para seu segmento' },
                  { icon: '📊', text: 'Simulação real com seus dados' },
                  { icon: '💰', text: 'ROI estimado para sua operação' },
                ].map((b, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, fontSize: '1rem', color: 'rgba(255,255,255,0.8)' }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: 10, background: 'rgba(95,192,165,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0,
                    }}>{b.icon}</span>
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div style={{
              padding: 40, borderRadius: 24, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <FormField label="Nome *" type="text" placeholder="Seu nome completo" />
                <FormField label="Email *" type="email" placeholder="seu@email.com" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <FormField label="Telefone *" type="tel" placeholder="(11) 99999-9999" />
                <FormField label="Empresa" type="text" placeholder="Nome da empresa" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Tamanho da equipe</label>
                <select style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none',
                }}>
                  <option value="" style={{ color: '#2B3946' }}>Selecione...</option>
                  <option style={{ color: '#2B3946' }}>1 a 3 vendedores</option>
                  <option style={{ color: '#2B3946' }}>4 a 10 vendedores</option>
                  <option style={{ color: '#2B3946' }}>11 a 30 vendedores</option>
                  <option style={{ color: '#2B3946' }}>Mais de 30 vendedores</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Mensagem (opcional)</label>
                <textarea rows={3} placeholder="Conte sobre seu processo de vendas..." style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', resize: 'vertical',
                }} />
              </div>
              <button style={{
                width: '100%', padding: 16, borderRadius: 14,
                background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`,
                color: 'white', fontWeight: 700, fontSize: '1.05rem', border: 'none', cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(55,156,139,0.3)',
              }}>Quero Minha Demo Gratuita →</button>
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                Ao enviar, você concorda com nossa Política de Privacidade.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FormField({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{label}</label>
      <input type={type} placeholder={placeholder} style={{
        width: '100%', padding: '14px 16px', borderRadius: 12,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'white', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none',
      }} />
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <>
      {/* CTA Strip */}
      <section style={{ padding: '64px 0', background: `linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint})`, textAlign: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <Reveal>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', marginBottom: 12 }}>Pronto para transformar suas vendas?</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 28 }}>Agende uma demo gratuita e veja a Amélia em ação.</p>
            <a href="#demo" style={{
              display: 'inline-flex', alignItems: 'center', padding: '14px 32px', borderRadius: 12,
              background: 'white', color: COLORS.tealPrimary, fontWeight: 600, fontSize: '1rem',
              textDecoration: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            }}>Agendar Demo →</a>
          </Reveal>
        </div>
      </section>

      <footer style={{ padding: '64px 0 32px', background: '#071e1e', color: 'rgba(255,255,255,0.5)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 48 }}>
            <div style={{ maxWidth: 300 }}>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 700, fontSize: '1.25rem', color: 'white', marginBottom: 16 }}>
                <img src={ICON_SRC} alt="Amélia CRM" style={{ height: 32, width: 32, borderRadius: 6 }} />
                <span style={{ color: COLORS.vividMint, fontWeight: 800 }}>amélia</span>CRM
              </a>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>O CRM com IA que transforma seu processo de vendas. Pipeline, WhatsApp, Email, Telefonia, CS e Gamificação em uma só plataforma.</p>
            </div>
            {[
              { title: 'Produto', links: [{ href: '#features', label: 'Funcionalidades' }, { href: '#brain', label: 'Como funciona' }, { href: '#comparison', label: 'Comparativo' }, { href: '#pricing', label: 'Preços' }] },
              { title: 'Recursos', links: [{ href: '#features', label: 'SDR com IA' }, { href: '#features', label: 'Pipeline Visual' }, { href: '#platform', label: 'Inbox Omnichannel' }, { href: '#features', label: 'Analytics' }] },
              { title: 'Empresa', links: [{ href: '#demo', label: 'Agendar Demo' }, { href: '#demo', label: 'Contato' }, { href: '#proof', label: 'Programa Piloto' }] },
            ].map((col, i) => (
              <div key={i}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>{col.title}</h5>
                {col.links.map((l, j) => (
                  <a key={j} href={l.href} style={{ display: 'block', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 12 }}>{l.label}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', flexWrap: 'wrap', gap: 16 }}>
            <span>© 2026 Amélia CRM — Blue Token Tecnologia. Todos os direitos reservados.</span>
            <div style={{ display: 'flex', gap: 24 }}>
              {['Termos de Uso', 'Política de Privacidade', 'LGPD'].map((t, i) => (
                <a key={i} href="#" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>{t}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Main Landing Page ───────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: COLORS.darkSlate, WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
        @keyframes scrollBounce { 0%,100%{transform:translateY(0);opacity:1} 50%{transform:translateY(8px);opacity:0.5} }
        @keyframes fadeInUp { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }

        .tag {
          display: inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; padding: 6px 16px; border-radius: 100px;
          background: rgba(55,156,139,0.1); color: ${COLORS.tealPrimary}; margin-bottom: 16px;
        }
        .tag-light { background: rgba(255,255,255,0.12); color: ${COLORS.lightMint}; }
        .section-title {
          font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.15;
          margin-bottom: 20px; color: ${COLORS.darkSlate};
        }
        .section-sub { font-size: 1.125rem; line-height: 1.7; color: #5a6b7a; max-width: 640px; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 12px;
          background: linear-gradient(135deg, ${COLORS.tealPrimary}, ${COLORS.vividMint});
          color: white; font-weight: 600; font-size: 0.95rem; text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 4px 15px rgba(55,156,139,0.3); transition: all 0.3s ease;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(55,156,139,0.4); }

        .persona-card {
          padding: 40px 32px; border-radius: 24px; background: white;
          border: 1px solid rgba(11,75,75,0.06); box-shadow: 0 4px 30px rgba(11,75,75,0.04);
          transition: all 0.4s cubic-bezier(0.22,1,0.36,1); overflow: hidden; position: relative; height: 100%;
        }
        .persona-card:hover { transform: translateY(-8px); box-shadow: 0 16px 50px rgba(11,75,75,0.1); }

        .brain-step {
          padding: 40px 28px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06); border-radius: 20px;
          transition: all 0.4s ease; backdrop-filter: blur(10px); height: 100%;
        }
        .brain-step:hover { background: rgba(255,255,255,0.08); transform: translateY(-4px); border-color: rgba(95,192,165,0.3); }

        .feature-card {
          padding: 32px 28px; border-radius: 20px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(10px);
          transition: all 0.4s ease; height: 100%;
        }
        .feature-card:hover { background: rgba(255,255,255,0.08); border-color: rgba(95,192,165,0.2); transform: translateY(-4px); }

        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-mobile-toggle { display: block !important; }
          .platform-compare-grid { grid-template-columns: 1fr !important; }
        }

        html { scroll-behavior: smooth; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
      `}</style>

      <Navbar />
      <Hero />
      <Personas />
      <BrainSection />
      <PlatformSection />
      <FeaturesSection />
      <ComparisonSection />
      <ProofSection />
      <PricingSection />
      <DemoSection />
      <Footer />
    </div>
  );
}
