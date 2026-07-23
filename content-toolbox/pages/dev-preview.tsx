import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@uniformdev/design-system';
import type { NextPage } from 'next';
import { useEffect, useState } from 'react';

import { ContentOpsToolkit } from '../components/content-ops-toolkit';
import { PageShell } from '../components/ui';

/**
 * Dev-only visual-QA page: renders the toolkit with mocked API data so UI work
 * can be checked outside the dashboard iframe (run `pnpm dev:http` and open
 * /dev-preview). _app skips MeshApp for this route in development; in
 * production builds the route is inert.
 */

const NODES_RAW: [string, string, string, string, string, string?][] = [
  ['EcoQuest', 'placeholder', '/', '', ''],
  ['Home', 'composition', '/:locale', 'Page', 'Home', 'Published'],
  ['Search', 'composition', '/:locale/search', 'Page', 'Search', 'Published'],
  ['Landing Pages', 'placeholder', '/:locale/landing-pages', '', ''],
  ['Demo', 'placeholder', '/:locale/demo', '', ''],
  ['Tours', 'composition', '/:locale/tours', 'Page', 'Tours', 'Published'],
  ['Destinations', 'composition', '/:locale/destinations', 'Page', 'Destinations', 'Published'],
  ['Interests', 'composition', '/:locale/interests', 'Page', 'Interests', 'Published'],
  ['Partners', 'composition', '/:locale/partners', 'Page', 'Partners', 'Published'],
  ['Blog', 'composition', '/:locale/blog', 'Page', 'Blog', 'Published'],
  ['Contact', 'composition', '/:locale/contact', 'Page', 'Contact', 'Published'],
  ['Products', 'placeholder', '/:locale/products', '', ''],
  ['Previews', 'placeholder', '/:locale/previews', '', ''],
  ['Blog post', 'composition', '/:locale/blog/:blog-post', 'Page', 'Blog post', 'Published'],
  ['QS Magic', 'composition', '/:locale/demo/qs-magic', 'Page', 'QS Magic', 'Draft'],
  ['Cloudinary', 'composition', '/:locale/demo/cloudinary', 'Page', 'Cloudinary', 'Published'],
  ['Blog Screen', 'composition', '/:locale/previews/screens/:blog-slug', 'Viewport Display', 'Blog Screen', 'Draft'],
  ['PDP', 'composition', '/:locale/products/:handle', 'Page', 'PDP', 'Published'],
  ['Tour Detail page', 'composition', '/:locale/tours/:tour', 'Page', 'Tour Detail page', 'Modified'],
  ['Sitemap', 'composition', '/sitemap.xml', 'Utility', 'Sitemap', 'Published'],
  ['Not Found', 'composition', '/404', 'Utility', '404', 'Published'],
];

const PARAMS = [
  'alignment', 'backgroundColor', 'buttonLabel', 'caption', 'ctaLink', 'description', 'eyebrow',
  'heroImage', 'layout', 'metaDescription', 'metaRobots', 'name', 'ogDescription', 'ogImage',
  'ogTitle', 'ogType', 'pageTitle', 'publishDate', 'readingTime', 'schemaType', 'subtitle',
  'theme', 'title', 'variant', 'width',
];

const REDIRECTS_RAW: [string, string, number, boolean][] = [
  ['/tours', '/en/tours', 301, true],
  ['/blog/*', '/en/blog/*', 301, true],
  ['/destinations/iceland', '/en/destinations/iceland-adventures', 301, false],
  ['/summer-sale', '/en/landing-pages/stockholm-summer-2026', 302, true],
  ['/partners.html', '/en/partners', 301, false],
  ['/old-contact', '/en/contact', 301, true],
  ['/winter-tours', '/en/tours', 301, true],
  ['/iceland', '/en/destinations/iceland-adventures', 301, true],
  ['/promo/spring', '/en/landing-pages/stockholm-summer-2026', 302, false],
  ['/products/snowboard-old', '/en/products/oxygen-snowboard', 301, true],
  ['/news/*', '/en/blog/*', 301, true],
  ['/about-us.html', '/en', 301, false],
  ['/getaway-2025', '/en/landing-pages/stockholm-summer-2026-romantic-getaway', 302, true],
];

const mapPayload = {
  projectMap: { id: 'pm-1', name: 'Sitemap' },
  parameterKeys: PARAMS,
  nodes: NODES_RAW.map((n, i) => ({
    id: `node-${i + 1}`,
    name: n[0],
    type: n[1],
    path: n[2],
    order: i,
    compositionType: n[3] || undefined,
    compositionName: n[4] || undefined,
    compositionId: n[1] === 'composition' ? `comp-${i + 1}` : undefined,
    publishStatus: n[5] || 'Unknown',
    parameters:
      n[1] === 'composition'
        ? {
            pageTitle: `${n[0]} | EcoQuest`,
            metaDescription: `Discover ${n[0].toLowerCase()} with EcoQuest — sustainable travel experiences.`,
            ogImage: `https://img.example.com/${n[0].toLowerCase().replace(/\s+/g, '-')}.jpg`,
            theme: i % 2 ? 'light' : 'dark',
          }
        : {},
  })),
};

const redirectsPayload = {
  redirects: REDIRECTS_RAW.map((r, i) => ({
    id: `redir-${i + 1}`,
    sourceUrl: r[0],
    targetUrl: r[1],
    targetStatusCode: r[2],
    sourceRetainQuerystring: r[3],
  })),
};

const queryClient = new QueryClient();

const DevPreviewPage: NextPage = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/uniform/project-map')) {
        return new Response(JSON.stringify(init?.method === 'POST' ? { succeeded: 5, errors: [] } : mapPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/uniform/redirects')) {
        return new Response(JSON.stringify(init?.method === 'POST' ? { succeeded: 3, errors: [] } : redirectsPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(input, init);
    };
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Theme />
      <PageShell>
        <ContentOpsToolkit projectId="preview" />
      </PageShell>
    </QueryClientProvider>
  );
};

export default DevPreviewPage;
