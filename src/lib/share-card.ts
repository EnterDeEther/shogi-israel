// Share cards: a square image for a moment worth telling friends about (a win against the computer, the
// puzzle of the week, a new rank, the rules course finished), drawn on a canvas in the site's look and shared
// through the phone's share sheet (WhatsApp, Instagram story) or downloaded on a computer.
// Every card carries the site's address, so a share is an invitation. Nothing is uploaded anywhere.

export interface Card {
  /** Big line, e.g. "ניצחתי את המחשב ברמה 4" */
  title: string;
  /** Smaller line under it */
  sub?: string;
  /** One or two kanji drawn large behind the text, e.g. 勝 */
  kanji?: string;
  /** The page the card points back to, shown at the bottom (without https://) */
  path?: string;
}

const SIZE = 1080;
const C = { washi: '#F6F1E7', washi2: '#EFE7D7', ink: '#1C1B19', ink2: '#4A463F', seal: '#B8361F', white: '#FFFFFF' };
const F = {
  display: "'Frank Ruhl Libre Variable', 'Frank Ruhl Libre', 'Noto Serif Hebrew', serif",
  body: "'Heebo Variable', 'Heebo', system-ui, sans-serif",
  kanji: "'Shippori Mincho', 'Noto Serif JP', serif",
};

/** Lines that fit `width`, broken at spaces (Hebrew wraps the same way). */
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
  // no orphan: a last line of one short word takes the word before it along
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
  // the faces may not be in use on this page yet: load the ones the card needs
  await Promise.all([
    document.fonts?.load(`900 92px ${F.display}`, card.title),
    document.fonts?.load(`700 40px ${F.body}`, 'שוגי ישראל'),
    document.fonts?.load(`700 64px ${F.kanji}`, `将棋${card.kanji ?? ''}`),
  ]).catch(() => undefined);
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = C.washi;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // a thin board-like frame
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, SIZE - 96, SIZE - 96);

  // the kanji, large and faint
  if (card.kanji) {
    ctx.fillStyle = C.washi2;
    ctx.font = `700 ${Math.min(560, Math.floor(880 / card.kanji.length))}px ${F.kanji}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.kanji, SIZE / 2, SIZE / 2 + 20);
  }

  // the logo: a red disc with 将棋 over ישראל
  const cx = SIZE / 2;
  const cy = 200;
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.arc(cx, cy, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 64px ${F.kanji}`;
  ctx.fillText('将棋', cx, cy + 10);
  ctx.direction = 'rtl';
  ctx.font = `700 30px ${F.body}`;
  ctx.fillText('ישראל', cx, cy + 50);

  // the title and the line under it
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

  // the way back to the site
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

/**
 * Share the card: the share sheet with the image where the browser can (phones), otherwise a download.
 * Returns what happened, for the button's label.
 */
export async function shareCard(card: Card, fileName = 'shogi-israel.png'): Promise<'shared' | 'saved' | 'cancelled'> {
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
      return 'cancelled'; // closed the sheet
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

/** A ready button: "שתפו" that makes and shares the card. */
export function shareButton(card: Card, fileName?: string, className = 'btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `${className} share-btn`;
  b.textContent = 'שתפו';
  b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await shareCard(card, fileName);
    b.disabled = false;
    if (r === 'saved') b.textContent = 'התמונה נשמרה. שתפו אותה';
  });
  return b;
}
