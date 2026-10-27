// Text that scripts put on the page after load can carry gender tokens too (lesson texts, toasts, the
// inbox, tips). Turn them into the same two spans as the static HTML as soon as they land, before paint,
// so a later switch of gender is CSS only. Attributes and the tab title can't hold spans: they keep both
// forms in data-g-<name> (data-g on <title>) and show the reader's, here and again on every switch.
import { TOKEN, GENDER_ATTRS, GENDER_KEY, hasToken, resolve, currentGender, applyGender, savedGender, type Gender } from '../lib/gender';

function fixText(node: Text): void {
  const s = node.data;
  if (!hasToken(s) || !node.parentNode) return;
  const parent = node.parentElement;
  if (parent && /^(SCRIPT|STYLE|TEXTAREA|TITLE|OPTION)$/.test(parent.tagName)) { node.data = resolve(s, currentGender()); return; }
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index > last) frag.append(s.slice(last, m.index));
    const male = document.createElement('span'); male.className = 'gm'; male.textContent = m[1];
    const female = document.createElement('span'); female.className = 'gf'; female.textContent = m[2];
    frag.append(male, female);
    last = m.index + m[0].length;
  }
  if (last < s.length) frag.append(s.slice(last));
  node.replaceWith(frag);
}

function fixAttrs(el: Element): void {
  for (const a of GENDER_ATTRS) {
    const v = el.getAttribute(a);
    if (v && hasToken(v)) { el.setAttribute(`data-g-${a}`, v); el.setAttribute(a, resolve(v, currentGender())); }
  }
}

function fixTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return fixText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) fixAttrs(root as Element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) { if (hasToken((n as Text).data)) texts.push(n as Text); } else fixAttrs(n as Element);
  }
  texts.forEach(fixText);
}

/** Shows the reader's form in every attribute and in the tab title. */
function syncAttrs(): void {
  const g = currentGender();
  for (const a of GENDER_ATTRS) {
    document.querySelectorAll(`[data-g-${a}]`).forEach((el) => el.setAttribute(a, resolve(el.getAttribute(`data-g-${a}`) ?? '', g)));
  }
  const t = document.querySelector('title[data-g]');
  if (t) document.title = resolve(t.getAttribute('data-g') ?? '', g);
}

new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'childList') r.addedNodes.forEach(fixTree);
    else if (r.type === 'characterData') fixText(r.target as Text);
    else if (r.type === 'attributes') fixAttrs(r.target as Element);
  }
  if (hasToken(document.title)) document.title = resolve(document.title, currentGender());
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: GENDER_ATTRS });
fixTree(document.body);
if (currentGender() === 'f') syncAttrs();
document.addEventListener('gender-changed', syncAttrs);

// The choice buttons ([data-gender-set]: sign-up form, account settings, footer). Pressed shows the saved
// choice only, so a reader who never chose sees neither pressed.
const markButtons = () => {
  const v = savedGender();
  document.querySelectorAll<HTMLElement>('[data-gender-set]').forEach((b) => {
    if (b.closest('.seg')) b.setAttribute('aria-pressed', String(b.dataset.genderSet === v));
  });
};
markButtons();
document.addEventListener('gender-changed', markButtons);
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-gender-set]');
  if (!b) return;
  const v: Gender = b.dataset.genderSet === 'f' ? 'f' : 'm';
  applyGender(v);
  // signed in: keep it with the account, so every device speaks the same way
  if (document.documentElement.hasAttribute('data-signed-in')) void import('../lib/account').then((m) => m.saveGender(v));
});

// A choice made in another tab.
window.addEventListener('storage', (e) => {
  if (e.key !== GENDER_KEY) return;
  if (e.newValue === 'f') document.documentElement.setAttribute('data-gender', 'f'); else document.documentElement.removeAttribute('data-gender');
  syncAttrs();
  markButtons();
});
