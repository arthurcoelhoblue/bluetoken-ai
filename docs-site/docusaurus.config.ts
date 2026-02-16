import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Amélia CRM — Documentação',
  tagline: 'Manual prático para Vendedores, CS, Gestores, Admins e Desenvolvedores',
  favicon: 'img/favicon.ico',

  url: 'https://docs.ameliacrm.com.br',
  baseUrl: '/',

  organizationName: 'blue-crm',
  projectName: 'amelia-crm-docs',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Amélia CRM',
      logo: {
        alt: 'Amélia CRM Logo',
        src: 'img/logo.svg',
      },
      items: [
        {to: '/docs/intro', label: '📖 Visão Geral', position: 'left'},
        {to: '/docs/vendedor/', label: '💼 Vendedor', position: 'left'},
        {to: '/docs/cs/', label: '🤝 CS', position: 'left'},
        {to: '/docs/gestor/', label: '📊 Gestor', position: 'left'},
        {to: '/docs/admin/', label: '⚙️ Admin', position: 'left'},
        {to: '/docs/desenvolvedor/', label: '🛠️ Dev', position: 'left'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentação',
          items: [
            {label: 'Guia Rápido', to: '/docs/guia-rapido'},
            {label: 'Vendedor', to: '/docs/vendedor/'},
            {label: 'CS', to: '/docs/cs/'},
          ],
        },
        {
          title: 'Configuração',
          items: [
            {label: 'Gestor', to: '/docs/gestor/'},
            {label: 'Admin', to: '/docs/admin/'},
            {label: 'Desenvolvedor', to: '/docs/desenvolvedor/'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Amélia CRM — Blue Group. Documentação gerada com Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['sql', 'bash', 'json'],
    },
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
