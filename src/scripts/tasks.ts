// Lesson tasks: makes the board above a <Task answer="..."> tappable and keyboard-operable,
// checks the answer, and records lesson completion on this device (and the account, if signed in).

const lessonId = document.querySelector<HTMLElement>('[data-lesson]')?.dataset.lesson ?? '';

function boardBefore(task: HTMLElement): HTMLElement | null {
  const inStep = task.closest('.step')?.querySelector<HTMLElement>('[data-board]');
  if (inStep) return inStep;
  let el = task.previousElementSibling as HTMLElement | null;
  while (el) {
    if (el.matches('[data-board]')) return el;
    if (el.tagName === 'HR' || el.tagName === 'H2') return null;
    const inner = el.querySelector<HTMLElement>('[data-board]');
    if (inner) return inner;
    el = el.previousElementSibling as HTMLElement | null;
  }
  return null;
}

function matches(answer: string, sq: string): boolean {
  if (answer.startsWith('rank:')) {
    const [a, b] = answer.slice(5).split('-').map(Number);
    const rank = Number(sq[1]);
    return rank >= a && rank <= (b ?? a);
  }
  return answer.split(',').map((s) => s.trim()).includes(sq);
}

function markDone() {
  const tasks = [...document.querySelectorAll<HTMLElement>('[data-task][data-answer]')];
  if (tasks.length && tasks.every((t) => t.classList.contains('done'))) {
    try { localStorage.setItem(`done:${lessonId}`, '1'); } catch {}
    document.dispatchEvent(new CustomEvent('progress-changed'));
    document.querySelector<HTMLElement>('[data-lesson-complete]')?.removeAttribute('hidden');
    // the whole rules course done: a card to share
    void import('../lib/course').then(async ({ RULES_COURSE }) => {
      const all = RULES_COURSE.every((l) => { try { return localStorage.getItem(`done:${l.slug}`) === '1'; } catch { return false; } });
      const box = document.querySelector<HTMLElement>('[data-lesson-complete]');
      if (!all || !box || box.querySelector('.share-btn')) return;
      const { shareButton } = await import('../lib/share-card');
      const p = document.createElement('span');
      p.className = 'course-done';
      p.append(' סיימת את כל השיעורים של חוקים בסיסיים! ', shareButton({ title: 'סיימתי את החוקים הבסיסיים של שוגי', sub: 'השחמט היפני, בעברית ומאפס. 8 שיעורים קצרים', kanji: '将棋', path: '/rules/' }, 'shogi-israel-rules.png', 'btn btn-ghost'));
      box.append(p);
    });
    // signed in with a starting point: where the course goes from here
    const slot = document.querySelector<HTMLElement>('[data-next-step]');
    if (slot && document.documentElement.hasAttribute('data-signed-in')) {
      void import('../lib/next-step').then(({ courseNext }) => {
        const n = courseNext();
        if (!n) return;
        const a = document.createElement('a');
        a.href = n.href;
        a.textContent = n.title;
        slot.replaceChildren(' הצעד הבא במסלול: ', a, ` (${n.kind}).`);
      });
    }
  }
}

function setupBoardTask(task: HTMLElement, answer: string) {
  const fig = boardBefore(task);
  const grid = fig?.querySelector<HTMLElement>('[data-grid]');
  const fbs = [fig?.querySelector<HTMLElement>('[data-board-fb]'), task.querySelector<HTMLElement>('.task-fb')]
    .filter((x): x is HTMLElement => !!x);
  if (!fig || !grid || !fbs.length) return;
  // Same message in both places; CSS shows the one next to the board for the current layout.
  const say = (cls: 'is-ok' | 'is-no', text: string) => fbs.forEach((f) => {
    f.classList.remove('is-ok', 'is-no');
    f.classList.add(cls);
    f.textContent = text;
  });
  const squares = [...grid.querySelectorAll<HTMLElement>('[data-sq]')];
  const hint = task.dataset.hint;
  const why = task.dataset.why;
  let misses = 0;
  grid.classList.add('live');
  grid.removeAttribute('aria-hidden');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'לוח לתרגול. חצים כדי לזוז, Enter כדי לבחור.');
  squares.forEach((s, i) => {
    s.setAttribute('role', 'button');
    s.setAttribute('aria-label', s.dataset.label ?? s.dataset.sq ?? '');
    s.tabIndex = i === 40 ? 0 : -1; // start on 55, the centre
  });

  const mark = (s: HTMLElement, cls: 'ok' | 'no', sign: string) => {
    s.classList.add(cls);
    const mk = document.createElement('span');
    mk.className = 'mk';
    mk.setAttribute('aria-hidden', 'true');
    mk.textContent = sign;
    s.append(mk);
  };
  const clearMisses = () =>
    squares.forEach((x) => {
      x.classList.remove('no');
      if (!x.classList.contains('ok')) x.querySelector('.mk')?.remove();
    });

  const choose = (s: HTMLElement) => {
    if (task.classList.contains('done')) return;
    const sq = s.dataset.sq ?? '';
    const what = (s.dataset.label ?? `משבצת ${sq}`).replace(/^משבצת \d\d, /, '');
    clearMisses();
    if (matches(answer, sq)) {
      mark(s, 'ok', '✓');
      say('is-ok', `נכון! משבצת ${sq}.` + (why ? ` ${why}` : ''));
      task.classList.add('done');
      fig.classList.add('revealed');
      const label = task.querySelector('.task-label');
      if (label) label.textContent = 'נפתר ✓';
      markDone();
    } else {
      misses++;
      mark(s, 'no', '✗');
      say('is-no', `לא. זו משבצת ${sq} (${what}). ⟦נסה|נסי⟧ שוב.` + (hint && misses >= 2 ? ` רמז: ${hint}` : ''));
    }
  };

  squares.forEach((s, i) => {
    s.addEventListener('click', () => choose(s));
    s.addEventListener('keydown', (e) => {
      // The board is left-to-right on screen whatever the page direction.
      const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -9, ArrowDown: 9 };
      if (e.key in moves) {
        const j = i + moves[e.key];
        const sameRow = Math.abs(moves[e.key]) === 1 ? Math.floor(j / 9) === Math.floor(i / 9) : true;
        if (j >= 0 && j < 81 && sameRow) {
          e.preventDefault();
          s.tabIndex = -1;
          squares[j].tabIndex = 0;
          squares[j].focus();
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        choose(s);
      }
    });
  });
}

function setupChoiceTask(task: HTMLElement, answer: string) {
  const fb = task.querySelector<HTMLElement>('.task-fb');
  task.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      task.querySelectorAll('[data-choice]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      if (!fb) return;
      if (b.dataset.choice === answer) {
        fb.textContent = 'נכון! הפותח עושה את המהלך הראשון.';
        task.classList.add('done');
        markDone();
      } else {
        fb.textContent = 'לא הפעם. מי שפותח את המשחק?';
      }
    });
  });
}

document.querySelectorAll<HTMLElement>('[data-task]').forEach((task) => {
  const answer = task.dataset.answer;
  if (!answer) return;
  if (task.dataset.kind === 'choice') setupChoiceTask(task, answer);
  else setupBoardTask(task, answer);
});
