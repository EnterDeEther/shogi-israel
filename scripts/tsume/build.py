"""Builds src/tsume/data/mate<N>.json from the generator's output (gen.py).

Drops repeats (a puzzle and its mirror image count as one), keeps at most a few puzzles with the same
mating pattern so the collection doesn't repeat itself, and orders each collection from easy to hard
(by how much searching the solver needed).

Usage: python scripts/tsume/build.py OUT_DIR IN.jsonl [IN.jsonl ...]
"""

import json
import sys
from collections import Counter

MAX_DUALS = {1: 0, 3: 0, 5: 1, 7: 1}  # other mating moves allowed on the last move (the player accepts any mate)
SAME_PATTERN = {1: 10, 3: 8, 5: 8, 7: 8}
LIMIT = {1: 600, 3: 1000, 5: 1000, 7: 1000}


def mirror_board(board):
    rows = []
    for row in board.split('/'):
        cells = []
        i = 0
        while i < len(row):
            c = row[i]
            if c.isdigit():
                cells += [''] * int(c)
            elif c == '+':
                cells.append(row[i:i + 2])
                i += 1
            else:
                cells.append(c)
            i += 1
        out, empty = '', 0
        for p in reversed(cells):
            if not p:
                empty += 1
                continue
            if empty:
                out += str(empty)
                empty = 0
            out += p
        if empty:
            out += str(empty)
        rows.append(out)
    return '/'.join(rows)


def pattern(p):
    """The last (mating) move: which piece, dropped or moved, and where relative to the king."""
    last = p['line'][-1]
    board = p['sfen'].split(' ')[0]
    king = None
    for r, row in enumerate(board.split('/')):
        f = 9
        i = 0
        while i < len(row):
            c = row[i]
            if c.isdigit():
                f -= int(c)
            else:
                if c == '+':
                    i += 1
                    c = row[i]
                if c == 'k':
                    king = (f, r)
                f -= 1
            i += 1
    to = (int(last[-2 - (last.endswith('+'))]), ord(last[-1 - (last.endswith('+'))]) - ord('a'))
    kind = last[0] if '*' in last else 'move'
    return (p['plies'], kind, to[0] - king[0], to[1] - king[1], king[1])


def main():
    out_dir, files = sys.argv[1], sys.argv[2:]
    seen = set()
    by_len = {}
    for path in files:
        for line in open(path):
            p = json.loads(line)
            n = p['plies']
            if n not in MAX_DUALS or p['duals'] > MAX_DUALS[n]:
                continue
            board, _, hand = p['sfen'].split(' ')[:3]
            key = (board, hand)
            if key in seen or (mirror_board(board), hand) in seen:
                continue
            seen.add(key)
            by_len.setdefault(n, []).append(p)
    for n, ps in sorted(by_len.items()):
        ps.sort(key=lambda p: (p['nodes'], p['sfen']))
        used = Counter()
        keep = []
        for p in ps:
            k = pattern(p)
            if used[k] >= SAME_PATTERN[n]:
                continue
            used[k] += 1
            keep.append(p)
        keep = keep[:LIMIT[n]]
        data = [[p['sfen'], ' '.join(p['line'])] for p in keep]
        with open(f'{out_dir}/mate{n}.json', 'w') as f:
            f.write('[\n' + ',\n'.join(json.dumps(d) for d in data) + '\n]\n')
        print(f'mate {n}: {len(ps)} candidates, {len(data)} kept', file=sys.stderr)


if __name__ == '__main__':
    main()
