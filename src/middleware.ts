import { defineMiddleware } from 'astro:middleware';
import { genderHtml } from './lib/gender';

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const html = await res.text();
  return new Response(genderHtml(html), { status: res.status, statusText: res.statusText, headers: res.headers });
});
