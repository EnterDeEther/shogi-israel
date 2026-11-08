// Ported from Lishogi (lila) ui/learn/src/ctrl.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/ctrl.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.
// Modified by Shogi Israel (shogi.co.il), 2026-11-07.
// Modified by Shogi Israel (shogi.co.il), 2026-11-08.

import type { Api } from 'shogiground/api';
import { Shogiground } from 'shogiground/shogiground';
import type { Piece } from 'shogiground/types';
import { opposite } from 'shogiground/util';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import type { Role } from 'shogiops/types';
import { makeSfen } from 'shogiops/sfen';
import { makeUsi, parseSquareName, parseUsi } from 'shogiops/util';
import { sameScenarioMove } from './assert';
import * as categories from './categories';
import * as ground from './ground';
import type { Category, LearnOpts, Stage, UsiWithColor, Vm } from './interfaces';
import { HINT_LINES } from './hint-lines';
import { hintMove } from './hint';
import { calcScore } from './level';
import { ProgressStorage } from './progress';
import {
  findCapture,
  findRandomMove,
  findUnprotectedCapture,
  illegalShogigroundDropDests,
  illegalShogigroundMoveDests,
  inCheck,
} from './shogi';
import { play as playSound, playMove } from './sound';
import { stageSlug, stageUrl } from './urls';
import { currentPosition, usiDests } from './util';
import { liveBounds } from '../lib/live-bounds';

const FAILURE_PLY_DELAY = 600;

export default class LearnCtrl {
  shogiground: Api;

  categories: Category[];
  stages: Stage[];

  vm?: Vm;

  timeouts: number[] = [];
  coachMinimized = false;
  progress: ProgressStorage;
  pref: any;

  constructor(
    private opts: LearnOpts,
    readonly redraw: Redraw,
    startStageKey?: string,
  ) {
    this.pref = opts.pref;

    this.categories = categories.categories;
    this.stages = categories.stages;

    this.progress = new ProgressStorage(this.opts);

    this.shogiground = liveBounds(Shogiground(ground.initConfig(this)));

    const startStage = this.stages.find(s => stageSlug(s.key) === startStageKey);
    if (startStage) {
      const lvl = Number.parseInt(window.location.hash.replace('#', ''));
      this.setLesson(startStage.id, Number.isFinite(lvl) ? lvl : 1);
    }
  }

  setHome(): void {
    this.clearTimetouts();
    this.vm = undefined;
    this.setUrl('/learn/');
  }

  private setUrl(url: string): void {
    const path = url.split('#')[0];
    if (window.location.pathname === path) window.history.replaceState('', '', url);
    else window.history.pushState('', '', url);
  }

  setLesson(stageId: number, levelId = 1): void {
    const category = this.categories.find(c => c.stages.some(s => s.id === stageId));
    const stage = category?.stages.find(s => s.id === stageId);
    const level = stage?.levels.find(l => l.id === levelId);

    if (category && stage && level) {
      this.clearTimetouts();
      const prevStage = this.vm?.stage;
      this.vm = {
        category,
        sideCategory: category.key,
        stage,
        stageState:
          prevStage?.id !== stage.id && !this.progress.has(stage.key) && level.id === 1
            ? 'init'
            : 'running',
        level,
        levelState: 'play',
        usiCList: [],
        coach: 'intro',
      };
      this.shogiground.selectSquare(null);
      this.shogiground.set(ground.initLevelConfig(level), true);
      this.applyOpponentMoveOrDrop();
      this.shogiground.set(ground.destsAndCheck(level, this.vm.usiCList));

      this.setUrl(`${stageUrl(stage.key)}#${level.id}`);
      if (prevStage?.id !== stage.id) window.scrollTo(0, 0);
      if (this.vm.stageState === 'init') playSound('start');
    } else this.setHome();
  }

  nextLesson(): void {
    this.clearTimetouts();
    if (this.vm && this.vm.level.id === this.vm.stage.levels.length && this.vm.levelState === 'completed' && this.vm.stageState === 'running') {
      this.vm.stageState = 'completed';
      this.vm.coach = undefined;
      playSound('end');
      return;
    }
    if (this.vm) {
      if (this.vm.level.id < this.vm.stage.levels.length)
        this.setLesson(this.vm.stage.id, this.vm.level.id + 1);
      else if (this.vm.stage.id < categories.stages.length) this.setLesson(this.vm.stage.id + 1);
      else this.setHome();
    }
  }

  restartLevel(): void {
    if (this.vm) {
      this.setLesson(this.vm.stage.id, this.vm.level.id);
      if (this.vm) this.vm.coach = undefined;
    }
    this.redraw();
  }

  completeLevel(): void {
    if (this.vm) {
      playSound('success');
      this.vm.levelState = 'completed';
      this.vm.coach = 'done';
      this.vm.waiting = false;
      this.vm.score = calcScore(this.vm.level, this.vm.usiCList);
      this.progress.saveScore(this.vm.stage.key, this.vm.level.id, this.vm.score);
      this.redraw();
    }
  }

  failLevel(): void {
    if (this.vm) {
      this.vm.levelState = 'fail';
      this.vm.coach = 'fail';
      playSound('fail');
      this.redraw();
    }
  }

  reset(): void {
    this.vm = undefined;
    this.progress.reset();
    this.redraw();
  }

  private clearTimetouts(): void {
    this.timeouts.forEach(t => {
      clearTimeout(t);
    });
    this.timeouts.length = 0;
  }

  private applyOpponentMoveOrDrop(): void {
    if (this.vm?.level.scenario) {
      const scenario = this.vm.level.scenario;
      const usiCList = this.vm.usiCList;
      const sUsiC = scenario[usiCList.length];
      const loose = this.vm.level.anyPromotion;

      if (
        sUsiC &&
        sUsiC.color !== this.vm.level.color &&
        usiCList.every((usiC, i) => {
          return sameScenarioMove(scenario[i].usi, usiC.usi, loose) && scenario[i].color === usiC.color;
        })
      ) {
        this.vm.usiCList.push(sUsiC);
        ground.playUsi(this, sUsiC);
      }
    }
  }

  private opponentPending(): boolean {
    const vm = this.vm!;
    const sc = vm.level.scenario;
    const next = sc?.[vm.usiCList.length];
    return !!next && next.color !== vm.level.color && vm.usiCList.every((u, i) => sameScenarioMove(sc![i].usi, u.usi, vm.level.anyPromotion) && sc![i].color === u.color);
  }

  showHint(): void {
    const vm = this.vm;
    if (!vm || vm.levelState !== 'play' || vm.waiting) return;
    const known = HINT_LINES[`${vm.stage.key}#${vm.level.id}`]?.split(' ');
    const usi = hintMove(vm.level, vm.usiCList, known);
    if (this.vm !== vm) return;
    vm.hint = usi;
    vm.hintNone = !usi;
    this.shogiground.set({ drawable: ground.createDrawable(vm.level, vm.usiCList, usi) });
    this.redraw();
  }

  private clearHint(): void {
    if (!this.vm) return;
    this.vm.hint = undefined;
    this.vm.hintNone = undefined;
  }

  private applyUserMoveOrDrop(usi: Usi): void {
    if (this.vm) {
      this.clearHint();
      this.vm.usiCList.push({ usi, color: this.vm.level.color });
      const check = inCheck(currentPosition(this.vm.level, this.vm.usiCList));
      this.shogiground.set({ checks: check });
      if (check) playSound('check');

      const level = this.vm.level;
      this.vm.coach = level.why ? 'move' : undefined;
      if (level.why && !this.coachMinimized && !level.failure?.(level, this.vm.usiCList) && this.opponentPending()) {
        this.vm.waiting = true;
        this.shogiground.set({ activeColor: undefined, movable: { dests: new Map() }, droppable: { dests: new Map() } });
        this.redraw();
        return;
      }

      this.applyOpponentMoveOrDrop();
      this.settle();
    }
  }

  continueAfterMove(): void {
    if (!this.vm) return;
    this.vm.waiting = false;
    this.vm.coach = undefined;
    this.applyOpponentMoveOrDrop();
    this.settle();
    this.redraw();
  }

  retryMove(): void {
    const vm = this.vm;
    if (!vm) return;
    this.clearTimetouts();
    const sc = vm.level.scenario;
    if (!sc) return this.restartLevel();
    let keep = 0;
    while (keep < vm.usiCList.length && sc[keep] && sameScenarioMove(sc[keep].usi, vm.usiCList[keep].usi, vm.level.anyPromotion) && sc[keep].color === vm.usiCList[keep].color) keep++;
    vm.usiCList = vm.usiCList.slice(0, keep);
    vm.levelState = 'play';
    vm.coach = undefined;
    this.clearHint();
    const sfen = makeSfen(currentPosition(vm.level, vm.usiCList)).split(' ');
    this.shogiground.set({ sfen: { board: sfen[0], hands: sfen[2] }, lastDests: keep ? usiDests(vm.usiCList[keep - 1].usi) : vm.level.lastDests ?? [] });
    this.refreshBoard();
    this.redraw();
  }

  private settle(): void {
    if (this.vm) {
      if (this.vm.level.success(this.vm.level, this.vm.usiCList)) this.completeLevel();
      else if (this.vm.level.failure?.(this.vm.level, this.vm.usiCList)) this.failLevel();

      const pos = currentPosition(this.vm.level, this.vm.usiCList);
      if (this.vm.levelState === 'fail' && this.vm.level.showFailureMove) {
        const found =
          this.vm.level.showFailureMove === 'capture'
            ? findCapture(pos)
            : this.vm.level.showFailureMove === 'unprotected'
              ? findUnprotectedCapture(pos)
              : this.vm.level.showFailureMove === 'random'
                ? findRandomMove(pos)
                : this.vm.level.showFailureMove(this.vm.level, this.vm.usiCList);
        let color = opposite(this.vm.level.color);
        const plies: UsiWithColor[] = [];

        for (const usi of typeof found === 'string' ? [found] : (found ?? [])) {
          const parsedUsi = parseUsi(usi);
          if (!parsedUsi || pos.board.getRole(parsedUsi.to) === 'king') break;
          const usiC = { usi, color };
          pos.turn = color;
          pos.play(parsedUsi);
          plies.push(usiC);
          color = opposite(color);
        }

        const vm = this.vm;
        const play = (usiC: UsiWithColor) => {
          vm.usiCList.push(usiC);
          ground.playUsi(this, usiC);
        };
        plies.forEach((usiC, i) => {
          if (i === 0) play(usiC);
          else
            this.timeouts.push(
              window.setTimeout(() => {
                if (this.vm !== vm) return;
                play(usiC);
                this.refreshBoard();
              }, FAILURE_PLY_DELAY * i),
            );
        });
      }
      this.refreshBoard();
    }
  }

  private refreshBoard(pos = currentPosition(this.vm!.level, this.vm!.usiCList)): void {
    if (this.vm) {
      const hasObstacles = !!this.vm.level.obstacles?.length;
      const illegalDests = !!this.vm.level.offerIllegalDests || hasObstacles;
      const active = this.vm.levelState !== 'fail' && this.vm.levelState !== 'completed';
      pos.turn = this.vm.level.color;

      this.shogiground.set({
        turnColor: this.vm.level.color,
        activeColor: active ? this.vm.level.color : undefined,
        checks: !hasObstacles && inCheck(pos),
        movable: {
          dests: active
            ? illegalDests
              ? illegalShogigroundMoveDests(pos)
              : shogigroundMoveDests(pos)
            : new Map(),
        },
        droppable: {
          dests: active
            ? illegalDests
              ? illegalShogigroundDropDests(pos)
              : shogigroundDropDests(pos)
            : new Map(),
        },
        drawable: ground.createDrawable(this.vm.level, this.vm.usiCList, this.vm.hint),
      });
    }
  }

  onUserMove(orig: Key, dest: Key, promotion: boolean): void {
    const usi = makeUsi({ from: parseSquareName(orig), to: parseSquareName(dest), promotion });
    this.applyUserMoveOrDrop(usi);
  }

  onUserDrop(piece: Piece, key: Key, _promotion: boolean): void {
    const usi = makeUsi({ role: piece.role as Role, to: parseSquareName(key) });
    this.applyUserMoveOrDrop(usi);
  }

  onMove(_orig: Key, _dest: Key, promotion: boolean, capturedPiece: Piece | undefined): void {
    playMove(!!capturedPiece, promotion);

    if (capturedPiece) {
      this.shogiground.addToHand({
        role: capturedPiece.role,
        color: opposite(capturedPiece.color),
      });
    }
  }

  onDrop(_piece: Piece, _key: Key): void {
    playSound('drop');
  }
}
