import type { APIRoute } from 'astro';
import { liveSections } from '../lib/nav';
import { resolve } from '../lib/gender';
import { RULES_COURSE } from '../lib/course';
import { categories } from '../learn/categories';
import { stageUrl } from '../learn/urls';
import { FAQ, plainAnswer } from '../lib/shogi-faq';

const SITE = 'https://shogi.co.il';
const abs = (href: string) => (href.startsWith('http') ? href : `${SITE}${href}`);
const plain = (s: string) => resolve(s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

export const GET: APIRoute = () => {
  const out: string[] = [
    '# שוגי ישראל (Shogi Israel)',
    '',
    '> The Hebrew home of shogi (将棋, Japanese chess) in Israel: free lessons from zero, 3,564 mate puzzles, play against the computer, and an Israeli community. The site is in Hebrew; everything is free, and most of it needs no sign-up.',
    '',
    'שוגי ישראל הוא האתר הישראלי של השוגי, השחמט היפני: לוח של 9 על 9, 20 כלים לכל צד, וכלי שנלכד עובר לצד של מי שלכד אותו (הצנחה). באתר לומדים מאפס בעברית, פותרים בעיות מט, משחקים נגד המחשב ומצטרפים לקהילה הישראלית.',
    '',
    'שמות נוספים למשחק: שחמט יפני, השחמט היפני, Shogi, Japanese chess, 将棋.',
    '',
    '## שאלות נפוצות (FAQ)',
    '',
    ...FAQ.map((f) => `- **${f.q}** ${plainAnswer(f.a)}`),
    '',
  ];
  for (const s of liveSections()) {
    out.push(`## ${plain(s.label)}`, '');
    for (const l of s.links) out.push(`- [${plain(l.label)}](${abs(l.href)})${l.hint ? `: ${plain(l.hint)}` : ''}`);
    out.push('');
  }
  out.push(
    '## שוגי לשחקני שחמט (Shogi for chess players)', '',
    `- [שוגי לשחקני שחמט](${SITE}/chess/): מה מוכר משחמט, מה חדש, ומסלול מהיר למשחק ראשון. אפשר לשחק עם סמלי שחמט על הכלים.`,
    '- לוח: בשחמט 8 על 8, בשוגי 9 על 9. כלים לכל צד: 16 בשחמט, 20 בשוגי.',
    '- אין מלכה. הכלי החזק ביותר הוא הדרקון, צריח שהוכתר.',
    '- כלי שנלכד עובר לצד של מי שלכד אותו, ואפשר להחזיר אותו ללוח (הצנחה). לכן תיקו נדיר: 2–3% במשחקי מקצוענים.',
    '- הכתרה: כמעט כל כלי, בשלוש השורות האחרונות. החייל לוכד ישר קדימה, לא באלכסון.',
    '- בכל עמדה כ־80 מהלכים חוקיים, לעומת כ־35 בשחמט.',
    '',
  );
  out.push('## חוקים בסיסיים (Shogi rules in Hebrew)', '');
  for (const l of RULES_COURSE) out.push(`- [שיעור ${l.n}: ${l.title}](${SITE}/rules/${l.slug}/)`);
  out.push('', '## שיעורים אינטראקטיביים (Interactive lessons)', '');
  for (const c of categories) for (const st of c.stages) out.push(`- [${plain(st.title)}](${SITE}${stageUrl(st.key)}): ${plain(st.subtitle)}`);
  out.push('', '## Optional', '', `- [About the site](${SITE}/about/)`, `- [Source code (AGPL-3.0)](https://github.com/EnterDeEther/shogi-israel)`, '');
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
