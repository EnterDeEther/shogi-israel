import json
import random
import sys
import time

import cshogi

TOTAL = {'P': 18, 'L': 4, 'N': 4, 'S': 4, 'G': 4, 'B': 2, 'R': 2}
ORDER = ['R', 'B', 'G', 'S', 'N', 'L', 'P']
DEF = [('g', 4), ('s', 3), ('p', 3), ('n', 1.5), ('l', 1.5), ('b', .6), ('r', .6), ('+r', .3), ('+b', .3)]
ATT = [('G', 3), ('S', 3), ('P', 2), ('N', 2.5), ('L', 1.5), ('B', 1.2), ('R', 1.2), ('+R', 1.2), ('+B', 1.2), ('+P', .8)]
HAND = [('G', 4), ('S', 3), ('N', 2), ('L', 1.5), ('P', 1), ('B', 1.5), ('R', 1.5)]
FAR = {'L', 'B', 'R', '+B', '+R'}

class Solver:

    def __init__(self, board, node_limit=300_000):
        self.b = board
        self.proved = {}
        self.disproved = {}
        self.nodes = 0
        self.limit = node_limit

    def checks(self):
        b = self.b
        out = []
        for m in b.legal_moves:
            b.push(m)
            if b.is_check():
                out.append(m)
            b.pop()
        return out

    def mates(self, plies):
        if plies < 1:
            return False
        b = self.b
        h = b.zobrist_hash()
        p = self.proved.get(h)
        if p is not None and p <= plies:
            return True
        d = self.disproved.get(h)
        if d is not None and d >= plies:
            return False
        self.nodes += 1
        if self.nodes > self.limit:
            raise TimeoutError
        ranked = []
        for m in self.checks():
            b.push(m)
            replies = list(b.legal_moves)
            b.pop()
            if not replies:
                self.proved[h] = 1
                return True
            ranked.append((len(replies), m, replies))
        ok = False
        if plies >= 3:
            ranked.sort(key=lambda x: x[0])
            for _, m, replies in ranked:
                b.push(m)
                good = True
                for r in replies:
                    b.push(r)
                    good = self.mates(plies - 2)
                    b.pop()
                    if not good:
                        break
                b.pop()
                if good:
                    ok = True
                    break
        if ok:
            self.proved[h] = min(p or plies, plies)
        else:
            self.disproved[h] = max(d or 0, plies)
        return ok

    def distance(self, max_plies):
        for n in range(1, max_plies + 1, 2):
            if self.mates(n):
                return n
        return None

    def defend(self, max_plies):
        b = self.b
        worst = 0
        replies = list(b.legal_moves)
        if not replies:
            return 0
        for r in replies:
            b.push(r)
            d = self.distance(max_plies - 1)
            b.pop()
            if d is None:
                return None
            worst = max(worst, d + 1)
        return worst

def hand_count(b, color):
    return sum(b.pieces_in_hand[color])

def analyse(sfen, max_plies):
    b = cshogi.Board(sfen)
    s = Solver(b)
    plies = s.distance(max_plies)
    if plies is None:
        return None
    line = []
    duals = 0
    left = plies
    while True:
        good = []
        for m in s.checks():
            b.push(m)
            if left == 1:
                if b.is_game_over():
                    good.append(m)
            elif s.defend(left - 1) == left - 1:
                good.append(m)
            b.pop()
        if left > 1 and len(good) != 1:
            return None
        if left == 1:
            duals = len(good) - 1
        line.append(good[0])
        b.push(good[0])
        if left == 1:
            break
        best = None
        for r in list(b.legal_moves):
            b.push(r)
            d = s.distance(left - 2)
            b.pop()
            score = d * 100 + (0 if cshogi.move_is_drop(r) else 10) + (1 if cshogi.move_cap(r) else 0)
            if best is None or score > best[0]:
                best = (score, r)
        line.append(best[1])
        b.push(best[1])
        left -= 2
    if hand_count(b, cshogi.BLACK):
        return None
    return {'plies': plies, 'line': [cshogi.move_to_usi(m) for m in line], 'duals': duals, 'nodes': s.nodes}

def make_sfen(board, hand):
    rows = []
    for r in range(9):
        row, empty = '', 0
        for f in range(8, -1, -1):
            p = board.get((f, r))
            if not p:
                empty += 1
                continue
            if empty:
                row += str(empty)
                empty = 0
            row += p
        if empty:
            row += str(empty)
        rows.append(row)
    used = {}
    for p in list(board.values()) + hand:
        base = p.replace('+', '').upper()
        if base != 'K':
            used[base] = used.get(base, 0) + 1
    hands = ''
    for p in ORDER:
        n = hand.count(p)
        if n:
            hands += (str(n) if n > 1 else '') + p
    for p in ORDER:
        n = TOTAL[p] - used.get(p, 0)
        if n < 0:
            return None
        if n:
            hands += (str(n) if n > 1 else '') + p.lower()
    return f"{'/'.join(rows)} b {hands or '-'} 1"

def legal_place(p, f, r, board):
    if (f, r) in board:
        return False
    att = p.upper() == p
    rr = r if att else 8 - r
    base = p.upper()
    if base in ('P', 'L') and rr == 0:
        return False
    if base == 'N' and rr <= 1:
        return False
    if base == 'P' and any(board.get((f, i)) == p for i in range(9)):
        return False
    return True

def pick(rng, weights):
    x = rng.random() * sum(w for _, w in weights)
    for v, w in weights:
        x -= w
        if x < 0:
            return v
    return weights[0][0]

def random_puzzle(rng):
    board = {}
    kf = pick(rng, [(0, 4), (1, 4), (2, 3), (3, 2), (4, 2), (5, 1), (6, 1), (7, 1), (8, 1)])
    kr = pick(rng, [(0, 7), (1, 3), (2, 1)])
    board[(kf, kr)] = 'k'

    def place(p, d, max_rank):
        for _ in range(25):
            f = kf + rng.randint(-d, d)
            r = kr + rng.randint(-d, d)
            if 0 <= f < 9 and 0 <= r <= max_rank and legal_place(p, f, r, board):
                board[(f, r)] = p
                return

    for _ in range(pick(rng, [(0, 2), (1, 3), (2, 3), (3, 2), (4, 1)])):
        place(pick(rng, DEF), 2, 3)
    for _ in range(pick(rng, [(0, 1), (1, 3), (2, 3), (3, 2)])):
        p = pick(rng, ATT)
        place(p, 4 if p in FAR else 2, 8 if p in FAR else 5)
    hand = [pick(rng, HAND) for _ in range(pick(rng, [(0, 1), (1, 4), (2, 4), (3, 2)]))]
    if len(board) + len(hand) < 3:
        return None
    return board, hand

def judge(sfen, max_plies):
    if sfen is None:
        return None
    b2 = cshogi.Board(sfen.replace(' b ', ' w '))
    if b2.is_check():
        return None
    try:
        return analyse(sfen, max_plies)
    except TimeoutError:
        return None

def df_pn_agrees(sfen):
    b = cshogi.Board(sfen)
    d = cshogi.DfPn(31, 2_000_000)
    return d.search(b)

def main():
    seed, minutes, out = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
    max_plies = int(sys.argv[4]) if len(sys.argv) > 4 else 7
    rng = random.Random(seed)
    until = time.time() + minutes * 60
    seen = set()
    tried = found = 0
    with open(out, 'a') as f:
        while time.time() < until:
            g = random_puzzle(rng)
            tried += 1
            if not g:
                continue
            board, hand = g
            sfen = make_sfen(board, hand)
            a = judge(sfen, max_plies)
            if not a:
                continue
            changed = True
            while changed:
                changed = False
                for sq, p in list(board.items()):
                    if p == 'k':
                        continue
                    del board[sq]
                    t = make_sfen(board, hand)
                    a2 = judge(t, max_plies)
                    if a2 and a2['plies'] == a['plies']:
                        a, sfen, changed = a2, t, True
                        break
                    board[sq] = p
            key = sfen.split(' ')[0]
            if key in seen or not df_pn_agrees(sfen):
                continue
            seen.add(key)
            found += 1
            f.write(json.dumps({'sfen': sfen, **a}) + '\n')
            f.flush()
    print(f'seed {seed}: tried {tried}, found {found}', file=sys.stderr)

if __name__ == '__main__':
    main()
