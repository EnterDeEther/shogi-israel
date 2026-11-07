// Ported from Lishogi (lila) ui/learn/src/progress.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/progress.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.

import type { LearnOpts, LearnProgress, Score } from './interfaces';
import { storage } from './storage';

const defaultProgress: LearnProgress = {
  stages: {},
};
const key = 'learn.progress';

export class ProgressStorage {
  progress: LearnProgress;

  constructor(opts: LearnOpts) {
    const storedProgess = storage.get(key);

    this.progress = opts.data || (storedProgess ? JSON.parse(storedProgess) : defaultProgress);
  }

  has(stageKey: string): boolean {
    if (stageKey in this.progress.stages) {
      const scores = this.progress.stages[stageKey];
      return !!scores && scores.scores.some(s => s > 0);
    }
    return false;
  }

  get(stageKey: string): number[] {
    return this.progress.stages[stageKey]?.scores || [];
  }

  reset(): void {
    storage.remove(key);
    this.progress.stages = {};
    document.dispatchEvent(new CustomEvent('progress-reset'));
  }

  saveScore(stageKey: string, levelId: number, score: Score): void {
    if (!this.progress.stages[stageKey]) this.progress.stages[stageKey] = { scores: [] };

    if (this.progress.stages[stageKey].scores[levelId - 1] >= score) return;
    this.progress.stages[stageKey].scores[levelId - 1] = score;

    storage.set(key, JSON.stringify(this.progress));
    document.dispatchEvent(new CustomEvent('progress-changed'));
  }

  reload(): void {
    const stored = storage.get(key);
    if (stored) this.progress = JSON.parse(stored);
  }
}
