// Ported from Lishogi (lila) ui/learn/src/ground.ts
// Source: https://github.com/WandererXII/lila/blob/89aea5f6f24c5e941c7cac8434a6e9e1acc15e94/ui/learn/src/ground.ts
// Copyright (c) 2019 onwards the li[shogi in sca]la authors.
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.
// Modified by Shogi Israel (shogi.co.il), 2026-10-24.

import type { Config } from 'shogiground/config';
import type { Drawable, SquareHighlight } from 'shogiground/draw';
import { shogigroundDropDests, shogigroundMoveDests } from 'shogiops/compat';
import type { Piece, Role } from 'shogiops/types';
import { isDrop, makeSquareName, parseSquareName, parseUsi } from 'shogiops/util';
import { pieceCanPromote, pieceForcePromote, promote } from 'shogiops/variant/util';
import type LearnCtrl from './ctrl';
import type { Level, UsiWithColor } from './interfaces';
import { illegalShogigroundDropDests, illegalShogigroundMoveDests, inCheck } from './shogi';
import { currentPosition } from './util';
import { SQUARE_RATIO } from '../lib/square-ratio';

export function initConfig(ctrl: LearnCtrl): Config {
  return {
    squareRatio: SQUARE_RATIO,
    movable: {
      free: false,
      showDests: ctrl.pref.dests,
      events: {
        after: ctrl.onUserMove.bind(ctrl),
      },
    },
    droppable: {
      free: false,
      showDests: ctrl.pref.dests,
      events: {
        after: ctrl.onUserDrop.bind(ctrl),
      },
    },
    promotion: {
      promotesTo: (role: Role) => {
        return promote('standard')(role);
      },
      movePromotionDialog: (orig: Key, dest: Key) => {
        const piece = ctrl.shogiground.state.pieces.get(orig) as Piece;
        return (
          !!piece &&
          pieceCanPromote('standard')(
            piece,
            parseSquareName(orig)!,
            parseSquareName(dest)!,
            undefined,
          ) &&
          !pieceForcePromote('standard')(piece, parseSquareName(dest)!)
        );
      },
      forceMovePromotion: (orig: Key, dest: Key) => {
        const piece = ctrl.shogiground.state.pieces.get(orig) as Piece;
        return !!piece && pieceForcePromote('standard')(piece, parseSquareName(dest)!);
      },
    },
    predroppable: {
      enabled: false,
    },
    premovable: {
      enabled: false,
    },
    animation: {
      enabled: ctrl.pref.animation,
    },
    coordinates: {
      enabled: true,
      files: 'numeric',
      ranks: 'numeric',
    },
    drawable: {
      enabled: true,
      visible: true,
    },
    events: {
      move: ctrl.onMove.bind(ctrl),
      drop: ctrl.onDrop.bind(ctrl),
    },
    draggable: {
      enabled: true,
      showGhost: true,
      showTouchSquareOverlay: true,
    },
    selectable: {
      enabled: true,
    },
    highlight: {
      check: true,
      lastDests: true,
    },
    hands: {
      inlined: true,
    },
  };
}

export function initLevelConfig(level: Level): Config {
  const splitSfen = level.sfen.split(' ');
  return {
    sfen: {
      board: splitSfen[0],
      hands: splitSfen[2],
    },
    turnColor: level.color,
    activeColor: level.color,
    orientation: level.color,
    lastDests: [],
    drawable: createDrawable(level),
  };
}

export function destsAndCheck(level: Level, usiCList: UsiWithColor[]): Config {
  const pos = currentPosition(level, usiCList);
  const hasObstacles = !!level.obstacles?.length;
  const illegalDests = !!level.offerIllegalDests || hasObstacles;

  return {
    checks: !hasObstacles && inCheck(pos),
    movable: {
      dests: illegalDests ? illegalShogigroundMoveDests(pos) : shogigroundMoveDests(pos),
    },
    droppable: {
      dests: illegalDests ? illegalShogigroundDropDests(pos) : shogigroundDropDests(pos),
    },
  };
}

export function createDrawable(level: Level, usiCList: UsiWithColor[] = []): Partial<Drawable> {
  const obastacles: SquareHighlight[] = [];
  const usis = usiCList.map(uc => uc.usi);
  const dests = usis.map(u => makeSquareName(parseUsi(u)!.to));
  const drawShapes = level.drawShapes?.(level, usiCList);
  const squares = level.squareHighlights?.(level, usiCList);

  if (level.obstacles)
    level.obstacles.forEach(o => {
      if (!dests.includes(o)) obastacles.push({ key: o, className: 'star' });
    });

  return {
    shapes: drawShapes || [],
    squares: (squares || []).concat(obastacles),
  };
}

export function playUsi(ctrl: LearnCtrl, usiC: UsiWithColor): void {
  const moveOrDrop = parseUsi(usiC.usi)!;
  if (isDrop(moveOrDrop)) {
    ctrl.shogiground.drop(
      { role: moveOrDrop.role, color: usiC.color },
      makeSquareName(moveOrDrop.to),
    );
  } else {
    ctrl.shogiground.move(
      makeSquareName(moveOrDrop.from),
      makeSquareName(moveOrDrop.to),
      moveOrDrop.promotion,
    );
  }
}
