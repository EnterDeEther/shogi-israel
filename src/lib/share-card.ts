export interface Card {
  title: string;
  sub?: string;
  kanji?: string;
  path?: string;
}

import { g } from './gender';

const SIZE = 1080;
const C = { washi: '#F6F1E7', washi2: '#EFE7D7', ink: '#1C1B19', ink2: '#4A463F', seal: '#B8361F' };
const F = {
  display: "'Frank Ruhl Libre Variable', 'Frank Ruhl Libre', 'Noto Serif Hebrew', serif",
  body: "'Heebo Variable', 'Heebo', system-ui, sans-serif",
  kanji: "'Shippori Mincho', 'Noto Serif JP', serif",
};

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > 1 && lines[lines.length - 1].length < 4) {
    const prev = lines[lines.length - 2].split(' ');
    if (prev.length > 1) {
      lines[lines.length - 1] = `${prev.pop()} ${lines[lines.length - 1]}`;
      lines[lines.length - 2] = prev.join(' ');
    }
  }
  return lines;
}

export async function drawCard(card: Card): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts?.load(`900 92px ${F.display}`, card.title),
    document.fonts?.load(`700 40px ${F.body}`, 'שוגי ישראל'),
    card.kanji && document.fonts?.load(`700 64px ${F.kanji}`, card.kanji),
  ]).catch(() => undefined);
  const logo = await new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = '/logo-512.png';
  });
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.washi;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, SIZE - 96, SIZE - 96);

  if (card.kanji) {
    ctx.fillStyle = C.washi2;
    ctx.font = `700 ${Math.min(560, Math.floor(880 / card.kanji.length))}px ${F.kanji}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.kanji, SIZE / 2, SIZE / 2 + 20);
  }

  if (logo) ctx.drawImage(logo, SIZE / 2 - 95, 105, 190, 190);
  const cx = SIZE / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'rtl';

  ctx.fillStyle = C.ink;
  ctx.font = `900 86px ${F.display}`;
  const title = wrap(ctx, card.title, SIZE - 180).slice(0, 3);
  let y = 470 - (title.length - 1) * 52;
  for (const line of title) {
    ctx.fillText(line, cx, y);
    y += 106;
  }
  if (card.sub) {
    ctx.fillStyle = C.ink2;
    ctx.font = `400 44px ${F.body}`;
    for (const line of wrap(ctx, card.sub, SIZE - 260).slice(0, 3)) {
      y += 6;
      ctx.fillText(line, cx, y);
      y += 58;
    }
  }

  ctx.fillStyle = C.seal;
  ctx.fillRect(cx - 60, SIZE - 210, 120, 6);
  ctx.fillStyle = C.ink;
  ctx.font = `700 40px ${F.body}`;
  ctx.fillText('שוגי ישראל', cx, SIZE - 145);
  ctx.direction = 'ltr';
  ctx.fillStyle = C.ink2;
  ctx.font = `500 36px ${F.body}`;
  ctx.fillText(`shogi.co.il${card.path ?? ''}`, cx, SIZE - 95);
  return cv;
}

export async function shareCard(tokens: Card, fileName = 'shogi-israel.png'): Promise<'shared' | 'saved' | 'cancelled'> {
  const card = { ...tokens, title: g(tokens.title), sub: tokens.sub && g(tokens.sub) };
  const cv = await drawCard(card);
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (!blob) return 'cancelled';
  const file = new File([blob], fileName, { type: 'image/png' });
  const url = `https://shogi.co.il${card.path ?? '/'}`;
  const data: ShareData = { files: [file], title: card.title, text: `${card.title} · ${url}` };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'saved';
}

export function shareButton(card: Card, fileName?: string, className = 'btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `${className} share-btn`;
  b.textContent = '⟦שתף|שתפי⟧';
  b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await shareCard(card, fileName);
    b.disabled = false;
    if (r === 'saved') b.textContent = 'התמונה נשמרה. ⟦שתף|שתפי⟧ אותה';
  });
  return b;
}
