// Which pages exist in this build, from the files in src/pages/ ("/src/pages/play/index.astro" -> "/play/").
// Lets a page point to /play/ or /account/ only once that page has landed, and fall back until then.

const routes = new Set(
  Object.keys(import.meta.glob('/src/pages/**/*.{astro,md,mdx}'))
    .filter((f) => !f.includes('['))
    .map((f) => f.replace(/^\/src\/pages/, '').replace(/\.(astro|mdx?)$/, '').replace(/\/index$/, '/'))
    .map((r) => (r.endsWith('/') ? r : `${r}/`)),
);

export const pageExists = (route: string): boolean => routes.has(route);

export const LISHOGI_TEAM = 'https://lishogi.org/team/---shogi-israel';
