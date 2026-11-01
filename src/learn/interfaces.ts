// Ported from Lishogi (lila) ui/learn/src/interfaces.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/interfaces.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.
// Modified by Shogi Israel (shogi.co.il), 2026-10-27.

import type { DrawShape, SquareHighlight } from 'shogiground/draw';

export type Score = 0 | 1 | 2 | 3;

type StageKey = string;
type StageId = number;
type LevelId = number;
type CategoryKey = string;

export interface UsiWithColor {
  usi: Usi;
  color: Color;
}

export type Shape = DrawShape | SquareHighlight;

export type VmEvaluation<T> = (level: Level, usiCList: UsiWithColor[]) => T;

export type Assertion = VmEvaluation<boolean>;

export type Scenario = UsiWithColor[];

export interface Level {
  id: LevelId;
  goal: string;
  sfen: Sfen;
  color: Color;
  nbMoves: number;

  success: Assertion;
  failure?: Assertion;

  obstacles?: Key[];
  scenario?: UsiWithColor[];

  drawShapes?: VmEvaluation<DrawShape[]>;
  squareHighlights?: VmEvaluation<SquareHighlight[]>;

  text?: string;
  line?: Usi[];
  moveNames?: string[];
  why?: string[];
  replies?: string[];
  replyNames?: string[];
  recap?: string;
  nextButton?: boolean;
  offerIllegalDests?: boolean;
  showFailureMove?: 'random' | 'capture' | 'unprotected' | VmEvaluation<Usi | undefined>;
}

export type IncompleteLevel = Omit<Level, 'id' | 'color'> & Partial<Pick<Level, 'color'>>;

export interface Stage {
  id: StageId;
  key: StageKey;
  title: string;
  subtitle: string;
  intro: string;
  complete: string;
  levels: Level[];
}

export type IncompleteStage = Omit<Stage, 'id'>;

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Category {
  key: CategoryKey;
  name: string;
  level: CourseLevel;
  stages: Stage[];
}

type StageState = 'init' | 'running' | 'completed' | 'end';
type LevelState = 'play' | 'completed' | 'fail';

export interface Vm {
  category: Category;
  sideCategory: CategoryKey;
  stage: Stage;
  stageState: StageState;
  level: Level;
  levelState: LevelState;
  usiCList: UsiWithColor[];
  score?: Score;
  coach?: 'intro' | 'move' | 'done' | 'fail';
  waiting?: boolean;
}

export interface LearnOpts {
  data?: LearnProgress;
  pref: any;
}

export interface LearnProgress {
  _id?: string;
  stages: Record<string, ProgressScore>;
}

interface ProgressScore {
  scores: Score[];
}
