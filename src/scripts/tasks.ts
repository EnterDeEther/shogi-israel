// Lesson tasks: makes the board above a <Task answer="..."> tappable and keyboard-operable,
// checks the answer, and records lesson completion on this device only.

const lessonId = document.querySelector<HTMLElement>('[data-lesson]')?.dataset.lesson ?? '';

function boardBefore(task: HTMLElement): HTMLElement | null {
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
    document.querySelector<HTMLElement>('[data-lesson-complete]')?.removeAttribute('hidden');
  }
}

function setupBoardTask(task: HTMLElement, answer: string) {
  const fig = boardBefore(task);
  const grid = fig?.querySelector<HTMLElement>('[data-grid]');
  const fb = task.querySelector<HTMLElement>('.task-fb');
  if (!grid || !fb) return;
  const squares = [...grid.querySelectorAll<HTMLElement>('[data-sq]')];
  grid.classList.add('live');
  grid.removeAttribute('aria-hidden');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'לוח לתרגול. חצים כדי לזוז, Enter כדי לבחור.');
  squares.forEach((s, i) => {
    s.setAttribute('role', 'button');
    s.setAttribute('aria-label', s.dataset.label ?? s.dataset.sq ?? '');
    s.tabIndex = i === 40 ? 0 : -1; // start on 55, the centre
  });

  const choose = (s: HTMLElement) => {
    if (task.classList.contains('done')) return;
    const sq = s.dataset.sq ?? '';
    squares.forEach((x) => x.classList.remove('no'));
    if (matches(answer, sq)) {
      s.classList.add('ok');
      fb.textContent = `נכון! משבצת ${sq}.`;
      task.classList.add('done');
      markDone();
    } else {
      s.classList.add('no');
      fb.textContent = `זו משבצת ${sq}. נסו שוב.`;
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
        fb.textContent = 'נכון! הפותח עושה את המסע הראשון.';
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
