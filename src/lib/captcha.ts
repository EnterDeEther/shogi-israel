// Cloudflare Turnstile on the account forms (Supabase checks the token server-side).
// Loaded only on /account/ and only when a site key is configured.
import { TURNSTILE_SITE_KEY } from './account-config';

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: Record<string, unknown>): string;
      reset(id: string): void;
      getResponse(id: string): string | undefined;
    };
  }
}

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile'));
    document.head.append(s);
  });
  return loading;
}

export interface Captcha {
  /** The current token, or undefined while the check hasn't passed yet. Single use: call reset() after submitting. */
  token(): string | undefined;
  reset(): void;
}

const none: Captcha = { token: () => undefined, reset: () => {} };

export async function mountCaptcha(el: HTMLElement | null): Promise<Captcha> {
  if (!TURNSTILE_SITE_KEY || !el) return none;
  await load();
  const id = window.turnstile!.render(el, { sitekey: TURNSTILE_SITE_KEY, language: 'he', theme: 'auto', size: 'flexible' });
  return {
    token: () => window.turnstile!.getResponse(id) || undefined,
    reset: () => window.turnstile!.reset(id),
  };
}

export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);
