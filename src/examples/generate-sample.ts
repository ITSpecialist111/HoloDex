/**
 * Sample PPTX Generation Script
 * 
 * Generates a demo presentation showcasing all slide types.
 * Usage: npx tsx src/examples/generate-sample.ts
 */

import { PptxEngine } from '../engine/pptx-engine.js';
import { PresentationRequestSchema, PRESET_PALETTES } from '../schemas.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function generateSample(): Promise<void> {
  console.log('🎯 HoloDex - Sample Generation\n');

  const engine = new PptxEngine();

  const palette = PRESET_PALETTES['midnight-executive'];

  // Full showcase presentation — use PresentationRequestSchema.parse() to apply defaults
  const request = PresentationRequestSchema.parse({
    title: 'HoloDex — Engine Showcase',
    outputFormat: 'buffer',
    theme: {
      palette,
      typography: {
        headerFont: 'Arial Black',
        bodyFont: 'Calibri',
        headingSize: 28,
        bodySize: 14,
      },
    },
    slides: [
      // 1. Title slide
      {
        type: 'title',
        title: 'HoloDex',
        subtitle: 'AI-Powered Presentation Engine',
        speakerNotes: 'Welcome to the demo of our PPTX generation engine.',
      },

      // 2. Agenda
      {
        type: 'agenda',
        title: 'Agenda',
        items: [
          { title: 'Engine Architecture' },
          { title: 'Slide Types Overview' },
          { title: 'Charts & Data Visualization' },
          { title: 'Branding & Themes' },
          { title: 'Deployment & Integration' },
        ],
        speakerNotes: 'Here is what we will cover today.',
      },

      // 3. Section divider
      {
        type: 'section',
        title: 'Core Capabilities',
        subtitle: 'What makes this engine powerful',
      },

      // 4. Content slide
      {
        type: 'content',
        title: 'Rich Content Support',
        body: 'The engine supports 21 different slide types, each with precise positioning, professional typography, and consistent design language.\n\nEvery slide is generated programmatically using PptxGenJS with careful attention to spacing, color contrast, and visual hierarchy.',
        speakerNotes: 'This is a standard content slide with multi-paragraph support.',
      },

      // 5. Two column
      {
        type: 'two-column',
        title: 'Two-Column Layout',
        leftTitle: 'From Scratch',
        leftContent: 'Create presentations with just a JSON request. Define slide types, content, and themes — the engine handles all layout and styling.',
        rightTitle: 'Template-Based',
        rightContent: 'Register brand configurations with logos, colors, and fonts. Generate branded presentations that match your corporate identity.',
      },

      // 6. Three column
      {
        type: 'three-column',
        title: 'Three Pillars of Design',
        columns: [
          {
            title: 'Typography',
            content: 'Carefully selected font pairings with proper hierarchy and sizing.',
          },
          {
            title: 'Color',
            content: '10 preset palettes designed for professional presentations.',
          },
          {
            title: 'Layout',
            content: 'Precise positioning with consistent margins and spacing.',
          },
        ],
      },

      // 7. Bullet list
      {
        type: 'bullet-list',
        title: 'Key Features',
        items: [
          { text: '21 slide types covering every presentation need' },
          { text: 'MCP server for agent-to-agent integration' },
          { text: 'REST API with full CRUD operations' },
          { text: 'Brand management system with logo support' },
          { text: 'Azure Container App deployment ready' },
          { text: 'Charts: bar, line, pie, and doughnut' },
          { text: 'Speaker notes on every slide' },
        ],
      },

      // 8. Section divider for charts
      {
        type: 'section',
        title: 'Data Visualization',
        subtitle: 'Charts and visual storytelling',
      },

      // 9. Bar chart
      {
        type: 'chart-bar',
        title: 'Quarterly Revenue',
        series: [
          { name: 'Q1', labels: ['Product A', 'Product B', 'Product C'], values: [42, 58, 35] },
          { name: 'Q2', labels: ['Product A', 'Product B', 'Product C'], values: [55, 62, 48] },
          { name: 'Q3', labels: ['Product A', 'Product B', 'Product C'], values: [68, 71, 52] },
        ],
        speakerNotes: 'Revenue is trending upward across all product lines.',
      },

      // 10. Line chart
      {
        type: 'chart-line',
        title: 'User Growth Trend',
        series: [
          { name: 'Users', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [1200, 1800, 2400, 3100, 4200, 5800] },
          { name: 'Active', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [950, 1400, 2000, 2600, 3500, 4900] },
        ],
      },

      // 11. Pie chart
      {
        type: 'chart-pie',
        title: 'Market Share Distribution',
        series: [
          { name: 'Share', labels: ['Enterprise', 'Mid-Market', 'SMB', 'Consumer'], values: [42, 28, 20, 10] },
        ],
        showPercent: true,
      },

      // 12. Doughnut chart
      {
        type: 'chart-doughnut',
        title: 'Budget Allocation',
        series: [
          { name: 'Budget', labels: ['Engineering', 'Marketing', 'Sales', 'Operations', 'R&D'], values: [35, 20, 25, 10, 10] },
        ],
        showPercent: true,
      },

      // 13. Section divider
      {
        type: 'section',
        title: 'Advanced Layouts',
        subtitle: 'Beyond basic slides',
      },

      // 14. Stat callout
      {
        type: 'stat-callout',
        title: 'By The Numbers',
        stats: [
          { value: '21', label: 'Slide Types' },
          { value: '10', label: 'Color Palettes' },
          { value: '50', label: 'Max Slides' },
          { value: '<1s', label: 'Generation Time' },
        ],
      },

      // 15. Comparison
      {
        type: 'comparison',
        title: 'Engine vs. Traditional Tools',
        leftTitle: 'HoloDex',
        leftItems: [
          'Fully programmatic — no GUI needed',
          'Consistent design every time',
          'API-driven for automation',
          'Agent-to-agent via MCP',
        ],
        rightTitle: 'Traditional Approach',
        rightItems: [
          'Manual slide creation',
          'Inconsistent formatting',
          'No automation support',
          'No AI integration',
        ],
      },

      // 16. Timeline
      {
        type: 'timeline',
        title: 'Development Roadmap',
        steps: [
          { title: 'Phase 1 — Core Engine', description: 'PptxGenJS integration, 21 slide renderers' },
          { title: 'Phase 2 — API Layer', description: 'REST API and MCP server' },
          { title: 'Phase 3 — Brand System', description: 'Logo, colors, master slides' },
          { title: 'Phase 4 — Azure Deploy', description: 'Container App with managed identity' },
        ],
      },

      // 17. Table
      {
        type: 'table',
        title: 'Feature Comparison Matrix',
        headers: ['Feature', 'HoloDex', 'MS Copilot', 'Google Slides AI'],
        rows: [
          ['Slide Types', '21+', '~8', '~6'],
          ['Custom Branding', 'Yes', 'Limited', 'No'],
          ['MCP Integration', 'Yes', 'No', 'No'],
          ['Speaker Notes', 'Yes', 'Sometimes', 'No'],
          ['Charts', '4 types', '2 types', '1 type'],
          ['API Access', 'Full REST', 'None', 'None'],
        ],
      },

      // 18. Quote
      {
        type: 'quote',
        quote: 'The best presentations are not made by clicking — they are generated by thinking.',
        attribution: 'HoloDex Philosophy',
        speakerNotes: 'This encapsulates our design-first, code-driven approach.',
      },

      // 19. Icon grid
      {
        type: 'icon-grid',
        title: 'Technology Stack',
        items: [
          { icon: { name: 'FaNodeJs', library: 'fa' as const }, title: 'Node.js', description: 'Runtime engine' },
          { icon: { name: 'FaDocker', library: 'fa' as const }, title: 'Docker', description: 'Containerization' },
          { icon: { name: 'FaMicrosoft', library: 'fa' as const }, title: 'Azure', description: 'Cloud platform' },
          { icon: { name: 'FaCode', library: 'fa' as const }, title: 'TypeScript', description: 'Type safety' },
          { icon: { name: 'FaChartBar', library: 'fa' as const }, title: 'PptxGenJS', description: 'PPTX generation' },
          { icon: { name: 'FaRobot', library: 'fa' as const }, title: 'MCP', description: 'Agent protocol' },
        ],
      },

      // 20. Team slide
      {
        type: 'team',
        title: 'Built By AI, For AI',
        members: [
          { name: 'Orchestrator Agent', role: 'Plans presentation structure' },
          { name: 'Design Engine', role: 'Resolves themes and palettes' },
          { name: 'PPTX Generator', role: 'Renders slides to PPTX' },
          { name: 'Brand Manager', role: 'Manages corporate identity' },
        ],
      },

      // 21. Image-text slide (will show placeholder when AI images aren't configured)
      {
        type: 'image-text',
        title: 'AI Image Generation',
        body: 'Add an aiImage field to any slide and HoloDex will generate a custom image using DALL-E 3 or GPT-image-1.\n\nRequires OPENAI_API_KEY or Azure OpenAI (API key or Entra ID).',
        image: { altText: 'AI Generated Image' },
        imagePosition: 'right',
        // Uncomment aiImage to generate with AI (requires OPENAI_API_KEY or Azure OpenAI config):
        // aiImage: { prompt: 'Futuristic AI brain with neural network connections, dark blue and gold palette' },
      },

      // 22. Closing
      {
        type: 'closing',
        title: 'Thank You',
        subtitle: 'github.com/holodex',
        contactInfo: {
          website: 'github.com/holodex',
          email: 'deploy@azure-container-apps.io',
        },
      },
    ],
  });

  console.log(`📊 Generating ${request.slides.length}-slide showcase presentation...`);
  
  const result = await engine.generate(request);
  
  // Write to file
  const outputDir = join(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  
  const filename = `sample-showcase-${Date.now()}.pptx`;
  const filepath = join(outputDir, filename);
  
  if (result.buffer) {
    writeFileSync(filepath, result.buffer);
    console.log(`\n✅ Generated: ${filepath}`);
    console.log(`   Slides: ${result.slideCount}`);
    console.log(`   Size: ${(result.buffer.length / 1024).toFixed(1)} KB`);
  }

  // Also generate a quick minimal presentation
  console.log('\n---\n');
  console.log('📊 Generating quick minimal presentation...');

  const coralPalette = PRESET_PALETTES['coral-energy'];

  const quickRequest = PresentationRequestSchema.parse({
    title: 'Quick Demo',
    outputFormat: 'buffer',
    theme: {
      palette: coralPalette,
    },
    slides: [
      { type: 'title', title: 'Quick Start', subtitle: 'Minimal presentation example' },
      {
        type: 'bullet-list',
        title: 'Three Simple Steps',
        items: [
          { text: 'Send a JSON request with your content' },
          { text: 'Engine generates professional PPTX' },
          { text: 'Download or receive base64 response' },
        ],
      },
      { type: 'closing', title: 'That\'s It!', subtitle: 'Simple, fast, beautiful' },
    ],
  });

  const quickResult = await engine.generate(quickRequest);

  const quickFilename = `sample-quick-${Date.now()}.pptx`;
  const quickFilepath = join(outputDir, quickFilename);

  if (quickResult.buffer) {
    writeFileSync(quickFilepath, quickResult.buffer);
    console.log(`\n✅ Generated: ${quickFilepath}`);
    console.log(`   Slides: ${quickResult.slideCount}`);
    console.log(`   Size: ${(quickResult.buffer.length / 1024).toFixed(1)} KB`);
  }

  console.log('\n🎉 Sample generation complete!');
}

generateSample().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
