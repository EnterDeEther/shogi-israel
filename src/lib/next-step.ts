import { nextStep, stepHref, KIND_LABEL } from './curriculum';
import { LEVEL_COUNTS } from './level-counts';
import { readLocal } from './progress-local';

export interface NextLink { href: string; title: string; kind: string }

export function courseNext(): NextLink | null {
  if (!document.documentElement.hasAttribute('data-signed-in')) return null;
  const p = readLocal();
  if (!p.course.route) return null;
  const n = nextStep(p, LEVEL_COUNTS);
  if (!n) return null;
  const href = stepHref(n.step, p, LEVEL_COUNTS);
  if (href === location.pathname) return null;
  return { href, title: n.step.title, kind: KIND_LABEL[n.step.kind] };
}
