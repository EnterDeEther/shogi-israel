// Shogi Israel: entry point for a Learn island. Replaces lila's build/main.ts + views/view.ts glue.
// AGPL-3.0-or-later, like the rest of src/learn/.
import LearnCtrl from './ctrl';
import { mount, render } from './view';

export function bootLearn(root: HTMLElement): LearnCtrl {
  const stageKey = root.dataset.stage;
  const { board } = mount(root);
  let ctrl: LearnCtrl;
  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(ctrl, root);
    });
  };
  ctrl = new LearnCtrl({ pref: {} }, redraw, stageKey);
  ctrl.shogiground.attach({ board });
  // lila redraws only when a level ends; we also redraw on each board change for the live star counter.
  ctrl.shogiground.set({ events: { change: redraw } });
  render(ctrl, root);
  // Overlays steal focus from the board so keyboard users can start the stage.
  root.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  return ctrl;
}
