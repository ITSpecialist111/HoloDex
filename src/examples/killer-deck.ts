/**
 * 🔥 Killer Deck — A showcase presentation that would make McKinsey jealous.
 */
import { pptxEngine } from '../engine/pptx-engine.js';
import { PresentationRequestSchema, PRESET_PALETTES } from '../schemas.js';
import type { Slide } from '../schemas.js';
import fs from 'fs/promises';
import path from 'path';

const slides: Slide[] = [
  // ─── OPENING ───────────────────────────────────────
  {
    type: 'title',
    title: 'Project Horizon',
    subtitle: 'Redefining the Future of Enterprise Intelligence',
    author: 'Strategy & Innovation Division',
    date: 'Q2 2026 Board Briefing',
    darkBackground: true,
    speakerNotes: 'Welcome everyone. Today we present Project Horizon — our most ambitious strategic initiative to date.',
  },

  {
    type: 'agenda',
    title: 'Today\'s Agenda',
    items: [
      { title: 'Market Landscape', description: 'Where we stand and where the industry is heading', duration: '10 min' },
      { title: 'The Opportunity', description: 'A $47B market gap we\'re uniquely positioned to capture', duration: '8 min' },
      { title: 'Product Vision', description: 'Project Horizon technical architecture & roadmap', duration: '15 min' },
      { title: 'Go-to-Market', description: 'Launch strategy, partnerships, and revenue model', duration: '10 min' },
      { title: 'Financial Projections', description: 'Unit economics, ARR targets, and funding ask', duration: '12 min' },
      { title: 'The Ask', description: 'What we need from the board to move forward', duration: '5 min' },
    ],
    speakerNotes: 'We have about 60 minutes. I\'ll leave 10 minutes for Q&A at the end.',
  },

  // ─── SECTION 1: MARKET ─────────────────────────────
  {
    type: 'section',
    title: 'The Market Landscape',
    subtitle: 'Understanding the seismic shift in enterprise AI',
    sectionNumber: 1,
  },

  {
    type: 'stat-callout',
    title: 'The Enterprise AI Market Is Exploding',
    stats: [
      { value: '$47B', label: 'Total Addressable Market by 2028', icon: { library: 'fa', name: 'FaGlobe' } },
      { value: '340%', label: 'YoY Growth in AI Spending', icon: { library: 'fa', name: 'FaChartLine' } },
      { value: '78%', label: 'of Fortune 500 Investing in AI', icon: { library: 'fa', name: 'FaBuilding' } },
      { value: '< 12%', label: 'Have a Coherent AI Strategy', icon: { library: 'fa', name: 'FaBullseye' } },
    ],
    speakerNotes: 'The gap between investment and strategy is our primary opportunity. Companies are spending but lack direction.',
  },

  {
    type: 'chart-bar',
    title: 'Enterprise AI Investment by Category (2024–2026)',
    series: [
      { name: '2024', labels: ['Infrastructure', 'Analytics', 'Automation', 'Gen AI', 'Security'], values: [12.4, 8.2, 6.1, 3.8, 4.5] },
      { name: '2025', labels: ['Infrastructure', 'Analytics', 'Automation', 'Gen AI', 'Security'], values: [15.1, 11.7, 9.3, 14.2, 6.8] },
      { name: '2026E', labels: ['Infrastructure', 'Analytics', 'Automation', 'Gen AI', 'Security'], values: [18.3, 14.9, 12.8, 28.6, 9.4] },
    ],
    commentary: 'Generative AI spending has grown 7.5× in two years — the fastest category acceleration since cloud computing.',
    speakerNotes: 'Note the Gen AI column — it went from the smallest to the largest category in just two years.',
  },

  {
    type: 'comparison',
    title: 'Today\'s Solutions vs. What Enterprises Need',
    leftTitle: '❌ Current Solutions',
    leftItems: [
      'Siloed point tools (50+ per enterprise)',
      'Months-long integration timelines',
      'Data locked in vendor ecosystems',
      'No cross-functional intelligence',
      'Reactive analytics only',
      'Requires dedicated ML engineering teams',
    ],
    rightTitle: '✅ What They Actually Need',
    rightItems: [
      'Unified intelligence platform',
      'Plug-and-play in days, not months',
      'Data sovereignty and portability',
      'Organization-wide knowledge graph',
      'Predictive and prescriptive insights',
      'Self-serve AI for every team',
    ],
    leftColor: 'E74C3C',
    rightColor: '27AE60',
    speakerNotes: 'This gap is where Project Horizon lives. Every bullet on the right is a core capability we\'re building.',
  },

  // ─── SECTION 2: OPPORTUNITY ────────────────────────
  {
    type: 'section',
    title: 'The Opportunity',
    subtitle: 'A once-in-a-decade platform shift',
    sectionNumber: 2,
  },

  {
    type: 'two-column',
    title: 'Why Now? Three Converging Forces',
    leftTitle: 'Technology Readiness',
    leftContent: 'Foundation models have reached enterprise-grade reliability. Inference costs dropped 94% in 18 months. RAG architectures solve the hallucination problem. Fine-tuning is now accessible without PhD-level expertise.',
    rightTitle: 'Market Demand',
    rightContent: 'CIOs report AI as their #1 priority for the third consecutive year, yet satisfaction with current tools is at an all-time low (NPS: -12). Budget allocation is shifting from experimentation to production deployment.',
    leftIcon: { library: 'fa', name: 'FaMicrochip' },
    rightIcon: { library: 'fa', name: 'FaUsers' },
    speakerNotes: 'The third force — regulatory pressure — is also accelerating adoption as companies need AI governance frameworks.',
  },

  {
    type: 'chart-pie',
    title: 'Where Enterprise AI Budgets Are Going (2026)',
    series: [{
      name: 'Budget Allocation',
      labels: ['Platform / Infrastructure', 'Custom Development', 'Vendor Solutions', 'Training & Upskilling', 'Governance & Compliance', 'Research & Experimentation'],
      values: [31, 24, 22, 11, 8, 4],
    }],
    commentary: '31% of budgets now go to platform infrastructure — up from 18% in 2024. Enterprises want to own their AI stack.',
    showPercent: true,
    speakerNotes: 'The "Platform" slice is our target. $14.5B annually and growing at 42% CAGR.',
  },

  // ─── SECTION 3: PRODUCT ────────────────────────────
  {
    type: 'section',
    title: 'Product Vision',
    subtitle: 'Introducing Project Horizon',
    sectionNumber: 3,
  },

  {
    type: 'content',
    title: 'What Is Project Horizon?',
    body: 'Project Horizon is an enterprise intelligence platform that unifies data, AI models, and business workflows into a single cognitive layer.\n\nUnlike point solutions that solve individual problems, Horizon creates a living knowledge graph of your entire organization — connecting people, processes, data, and decisions in real time.\n\nThink of it as the "operating system for enterprise intelligence" — every team gets AI-powered insights without writing a single line of code.',
    icon: { library: 'fa', name: 'FaRocket', color: '3498DB' },
    speakerNotes: 'The key differentiator: it\'s not another AI tool, it\'s the platform that makes all your AI tools work together.',
  },

  {
    type: 'icon-grid',
    title: 'Core Capabilities',
    items: [
      { title: 'Universal Data Fabric', description: 'Connect any data source in minutes. 200+ native connectors.', icon: { library: 'fa', name: 'FaDatabase', color: '3498DB' } },
      { title: 'Knowledge Graph Engine', description: 'Auto-builds entity relationships across your entire org.', icon: { library: 'fa', name: 'FaProjectDiagram', color: '9B59B6' } },
      { title: 'AI Model Orchestration', description: 'Run any model — OpenAI, Anthropic, open-source — unified API.', icon: { library: 'fa', name: 'FaBrain', color: 'E67E22' } },
      { title: 'Workflow Automation', description: 'Natural language → automated business process. Zero code.', icon: { library: 'fa', name: 'FaCogs', color: '2ECC71' } },
      { title: 'Predictive Analytics', description: 'Forecast revenue, churn, demand, and operational risks.', icon: { library: 'fa', name: 'FaChartLine', color: 'E74C3C' } },
      { title: 'Enterprise Governance', description: 'Full audit trail, RBAC, PII detection, bias monitoring.', icon: { library: 'fa', name: 'FaShieldAlt', color: '1ABC9C' } },
    ],
    speakerNotes: 'Each capability is a product in its own right, but the magic is how they work together on a shared knowledge graph.',
  },

  {
    type: 'timeline',
    title: 'Product Roadmap — 18-Month Horizon',
    steps: [
      { title: 'Q2 2026', description: 'Core platform launch: data fabric + knowledge graph + model orchestration', icon: { library: 'fa', name: 'FaFlag' } },
      { title: 'Q3 2026', description: 'Workflow automation engine + 50 pre-built industry templates', icon: { library: 'fa', name: 'FaCogs' } },
      { title: 'Q4 2026', description: 'Predictive analytics suite + real-time anomaly detection', icon: { library: 'fa', name: 'FaChartBar' } },
      { title: 'Q1 2027', description: 'Multi-agent orchestration for complex workflows', icon: { library: 'fa', name: 'FaUsers' } },
      { title: 'Q3 2027', description: 'Industry-specific vertical solutions (FinServ, Healthcare, Manufacturing)', icon: { library: 'fa', name: 'FaIndustry' } },
    ],
    speakerNotes: 'We\'re currently in private alpha with 5 design partners. Public beta planned for late Q2.',
  },

  // ─── SECTION 4: GTM ────────────────────────────────
  {
    type: 'section',
    title: 'Go-to-Market Strategy',
    subtitle: 'Land, expand, dominate',
    sectionNumber: 4,
  },

  {
    type: 'three-column',
    title: 'Three-Phase Market Entry',
    columns: [
      {
        title: 'Phase 1: Land',
        content: 'Target mid-market enterprises (500–5,000 employees) with the data fabric. Fast time-to-value. Self-serve onboarding. $5K–$25K ACV. Land in IT/data teams.',
        icon: { library: 'fa', name: 'FaParachute' },
      },
      {
        title: 'Phase 2: Expand',
        content: 'Upsell knowledge graph + AI orchestration. Expand to business units. Professional services for enterprise accounts. $50K–$250K ACV.',
        icon: { library: 'fa', name: 'FaExpandArrowsAlt' },
      },
      {
        title: 'Phase 3: Dominate',
        content: 'Platform-wide deployment across Fortune 500. Industry solutions. Partner ecosystem. $500K–$2M+ ACV. Mission-critical status.',
        icon: { library: 'fa', name: 'FaCrown' },
      },
    ],
    speakerNotes: 'This mirrors the Slack, Datadog, and Snowflake playbooks — all reached $1B ARR with this motion.',
  },

  {
    type: 'chart-line',
    title: 'Customer Acquisition Trajectory',
    series: [
      { name: 'Total Customers', labels: ['Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q1 28'], values: [12, 35, 78, 140, 245, 380, 520, 710] },
      { name: 'Enterprise (>1K employees)', labels: ['Q2 26', 'Q3 26', 'Q4 26', 'Q1 27', 'Q2 27', 'Q3 27', 'Q4 27', 'Q1 28'], values: [5, 12, 28, 52, 95, 160, 230, 320] },
    ],
    commentary: 'Enterprise mix grows from 42% to 45% — critical for ACV expansion and net revenue retention.',
    smooth: true,
    speakerNotes: 'These numbers are conservative based on current pipeline and conversion rates from alpha.',
  },

  // ─── SECTION 5: FINANCIALS ─────────────────────────
  {
    type: 'section',
    title: 'Financial Projections',
    subtitle: 'The path to $100M ARR',
    sectionNumber: 5,
  },

  {
    type: 'stat-callout',
    title: 'Key Financial Metrics (2027 Target)',
    stats: [
      { value: '$42M', label: 'Annual Recurring Revenue', icon: { library: 'fa', name: 'FaDollarSign' } },
      { value: '142%', label: 'Net Revenue Retention', icon: { library: 'fa', name: 'FaSync' } },
      { value: '< 24mo', label: 'CAC Payback Period', icon: { library: 'fa', name: 'FaClock' } },
      { value: '78%', label: 'Gross Margin', icon: { library: 'fa', name: 'FaPercentage' } },
    ],
    speakerNotes: '142% NRR means existing customers spend 42% more each year — driven by the expand motion.',
  },

  {
    type: 'chart-bar',
    title: 'Revenue Projection — ARR Growth ($M)',
    series: [
      { name: 'Platform Revenue', labels: ['H2 2026', 'H1 2027', 'H2 2027', 'H1 2028', 'H2 2028'], values: [3.2, 12.5, 28.8, 52.4, 78.1] },
      { name: 'Professional Services', labels: ['H2 2026', 'H1 2027', 'H2 2027', 'H1 2028', 'H2 2028'], values: [0.8, 2.1, 4.2, 7.6, 11.3] },
      { name: 'Marketplace / Add-ons', labels: ['H2 2026', 'H1 2027', 'H2 2027', 'H1 2028', 'H2 2028'], values: [0, 0.4, 1.8, 5.2, 12.6] },
    ],
    stacked: true,
    commentary: 'Total ARR reaches $102M by H2 2028. Platform revenue remains 75%+ of total — healthy SaaS mix.',
    speakerNotes: 'The marketplace revenue kicks in meaningfully in 2028 as the partner ecosystem matures.',
  },

  {
    type: 'table',
    title: 'Unit Economics Deep Dive',
    headers: ['Metric', 'Current', '2027 Target', 'Best-in-Class'],
    rows: [
      ['Average Contract Value', '$18K', '$62K', '$85K+'],
      ['Customer Acquisition Cost', '$32K', '$28K', '$22K'],
      ['LTV:CAC Ratio', '3.2×', '5.8×', '7.0×+'],
      ['Gross Margin', '72%', '78%', '82%+'],
      ['Net Revenue Retention', '118%', '142%', '150%+'],
      ['Payback Period', '28 months', '18 months', '12 months'],
      ['Logo Churn (Annual)', '8%', '4%', '< 3%'],
    ],
    speakerNotes: 'We benchmark against Datadog, Snowflake, and CrowdStrike — the best enterprise SaaS companies.',
  },

  // ─── SECTION 6: THE ASK ────────────────────────────
  {
    type: 'section',
    title: 'The Ask',
    subtitle: 'What we need to make this happen',
    sectionNumber: 6,
  },

  {
    type: 'bullet-list',
    title: 'Series B: $85M to Capture the Window',
    items: [
      { text: 'Engineering & Product (55%)', subItems: ['Scale team from 28 to 85 engineers', 'Accelerate knowledge graph R&D', 'Build industry-specific solutions'], icon: { library: 'fa', name: 'FaCode' } },
      { text: 'Sales & Marketing (30%)', subItems: ['Build enterprise sales team (12 AEs, 6 SEs)', 'Launch partner program with 3 GSIs', 'Brand awareness campaign in target verticals'], icon: { library: 'fa', name: 'FaBullhorn' } },
      { text: 'Operations & Infrastructure (10%)', subItems: ['SOC 2 Type II + HIPAA certification', 'Multi-region deployment (US, EU, APAC)', 'Enterprise SLA guarantees (99.99%)'], icon: { library: 'fa', name: 'FaServer' } },
      { text: 'Strategic Reserve (5%)', subItems: ['Opportunistic acquisitions', 'Extension runway to 30+ months'], icon: { library: 'fa', name: 'FaPiggyBank' } },
    ],
    speakerNotes: 'At our current burn rate, this gives us 26 months of runway — well into profitability trajectory.',
  },

  {
    type: 'quote',
    quote: 'The companies that will dominate the next decade are the ones building the intelligence layer between data and decisions. Project Horizon is that layer.',
    attribution: 'Dr. Sarah Chen',
    role: 'Chief Technology Officer, Project Horizon',
    speakerNotes: 'Sarah has been the driving force behind our technical architecture. Her team is world-class.',
  },

  {
    type: 'closing',
    title: 'Let\'s Build the Future',
    subtitle: 'Project Horizon — Enterprise Intelligence, Unified',
    contactInfo: {
      email: 'investors@projecthorizon.ai',
      website: 'projecthorizon.ai/board',
      phone: '+1 (415) 555-0199',
    },
    speakerNotes: 'Thank you. I\'m excited to answer your questions. Detailed appendix materials have been shared to your email.',
  },
];

async function main() {
  console.log('\n🔥 Generating Killer Deck: Project Horizon\n');

  const result = await pptxEngine.generate(PresentationRequestSchema.parse({
    title: 'Project Horizon — Enterprise Intelligence Platform',
    author: 'Strategy & Innovation Division',
    description: 'Series B board presentation for Project Horizon',
    slides,
    theme: {
      palette: {
        primary: '0F172A',       // Deep navy
        secondary: '3B82F6',     // Electric blue
        accent: '06B6D4',        // Cyan accent
        background: 'FFFFFF',
        backgroundDark: '0F172A',
        text: '1E293B',
        textLight: '64748B',
        textOnDark: 'F1F5F9',
      },
      typography: {
        headerFont: 'Trebuchet MS',
        bodyFont: 'Calibri',
        titleSize: 42,
        subtitleSize: 22,
        headingSize: 26,
        bodySize: 14,
        captionSize: 11,
      },
      visualMotif: 'accent-borders',
    },
    outputFormat: 'file',
    outputFileName: 'project-horizon-board-deck.pptx',
  }));

  if (result.success) {
    const stats = await fs.stat(result.filePath!);
    console.log(`✅ Generated: ${result.filePath}`);
    console.log(`   Slides: ${result.slideCount}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
    if (result.warnings?.length) {
      console.log(`   ⚠️  Warnings: ${result.warnings.join(', ')}`);
    }
  } else {
    console.error('❌ Generation failed:', result.errors);
  }

  console.log('\n🎯 Done!\n');
}

main().catch(console.error);
