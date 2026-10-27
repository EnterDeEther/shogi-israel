// Ported from Lishogi (lila) ui/learn/src/interfaces.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/interfaces.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24: added the coach state (Vm.coach, Vm.waiting) and the opening data (Level.why, moveNames, line, replies, replyNames).
// Modified by Shogi Israel, 2026-10-27: Category.level (the course's three levels).

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
  goal: string; // i18n string displayed on the right
  sfen: Sfen; // starting position of the level
  color: Color; // user's color
  nbMoves: number; // number of moves it takes to get perfect score

  success: Assertion;
  failure?: Assertion;

  obstacles?: Key[]; // placed on the board, can be 'captured', offerIllegalDests by default for king collisions
  scenario?: UsiWithColor[];

  drawShapes?: VmEvaluation<DrawShape[]>;
  squareHighlights?: VmEvaluation<SquareHighlight[]>;

  text?: string; // helping text displayed on the board
  line?: Usi[]; // Shogi Israel: the textbook order for castle exercises, which accept any order (used by the tests)
  moveNames?: string[]; // Shogi Israel: the user's moves in our notation (P-76), for the coach popup
  why?: string[]; // Shogi Israel: why each of the user's moves is played, shown one by one as they are made
  replies?: string[]; // Shogi Israel: what each of the opponent's scripted replies is for
  replyNames?: string[]; // Shogi Israel: the opponent's replies in our notation
  nextButton?: boolean; // wait for user to click next - allows user to review the solution
  offerIllegalDests?: boolean;
  showFailureMove?: 'random' | 'capture' | 'unprotected' | VmEvaluation<Usi | undefined>; // played after failure
}

export type IncompleteLevel = Omit<Level, 'id' | 'color'> & Partial<Pick<Level, 'color'>>;

export interface Stage {
  id: StageId;
  key: StageKey;
  title: string; // title to the right of the board
  subtitle: string; // below title
  intro: string; // overlay when stage starts
  complete: string; // overlay after stage is completed
  levels: Level[];
}

export type IncompleteStage = Omit<Stage, 'id'>;

/** The course's three levels (Shogi Israel): each map category belongs to one. */
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
  // Shogi Israel: the coach popup beside the board (view.ts renderCoach) and whether the opponent's
  // reply is waiting for the learner to press "continue" after reading why their move was played
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
