// Saved in learn.prefs on this device. AGPL-3.0-or-later, like the rest of src/learn/.
import { type LearnPrefs, loadPrefs, savePrefs } from './prefs';
import { applyHaptics, hapticsSupported } from './haptics';
import { type SoundName, type SoundPref, applySoundPrefs, play, preloadSounds } from './sound';

export const SOUND_TYPES: { key: SoundPref; label: string; sample: SoundName }[] = [
  { key: 'sndBoard', label: 'הכלים על הלוח', sample: 'move' },
  { key: 'sndGame', label: 'תחילת משחק וסיומו', sample: 'gameStart' },
  { key: 'sndLessons', label: 'שיעורים ובעיות', sample: 'success' },
  { key: 'sndProgress', label: 'נקודות ודרגות', sample: 'points' },
  { key: 'sndUi', label: 'כפתורים ותפריטים', sample: 'tap' },
];

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function soundControls(prefix: string, cls: string, box = ''): HTMLElement {
  const p = loadPrefs();
  const root = node('div', 'sound-controls');
  const save = (edit: (q: LearnPrefs) => void): LearnPrefs => {
    const q = loadPrefs();
    edit(q);
    savePrefs(q);
    applySoundPrefs(q);
    return q;
  };
  const row = (id: string, label: string, checked: boolean, onChange: (on: boolean) => void, sub = false) => {
    const l = node('label', `${cls}${sub ? ' sound-sub' : ''}`);
    l.htmlFor = id;
    const i = node('input', box);
    i.type = 'checkbox';
    i.id = id;
    i.checked = checked;
    i.addEventListener('change', () => onChange(i.checked));
    l.append(i, node('span', '', label));
    return l;
  };

  const rest = node('div', 'sound-rest');
  rest.hidden = !p.sound;
  root.append(row(`${prefix}-sound`, 'כל הצלילים', p.sound, (on) => {
    save((q) => { q.sound = on; });
    rest.hidden = !on;
    if (on) void preloadSounds().then(() => play('move'));
  }));

  const vol = node('div', 'sound-vol');
  const vl = node('label', '', 'עוצמה');
  vl.htmlFor = `${prefix}-vol`;
  const range = node('input');
  range.type = 'range';
  range.id = `${prefix}-vol`;
  range.min = '0';
  range.max = '100';
  range.step = '5';
  range.value = String(Math.round(p.vol * 100));
  range.addEventListener('input', () => save((q) => { q.vol = Number(range.value) / 100; }));
  range.addEventListener('change', () => void preloadSounds().then(() => play('move')));
  vol.append(vl, range);
  rest.append(vol);

  for (const t of SOUND_TYPES)
    rest.append(row(`${prefix}-${t.key}`, t.label, p[t.key], (on) => {
      save((q) => { q[t.key] = on; });
      if (on) void preloadSounds().then(() => play(t.sample));
    }, true));
  root.append(rest);

  if (hapticsSupported())
    root.append(row(`${prefix}-haptics`, 'רטט בטלפון', p.haptics, (on) => {
      save((q) => { q.haptics = on; });
      applyHaptics(on);
    }));
  return root;
}
