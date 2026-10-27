# Beginner terms: where each one is taught

Rule (Dean, 27 Oct 2026): a newcomer never meets a word, piece or rule before the course teaches it, and nothing assumes chess. This list is the order in which the beginner stages teach each term. `test/beginner-terms.test.ts` checks it on every run: it fails if a term shows up in any text the learner reads before the place listed here.

"Where" is the stage and the exercise (תרגיל) number. "Intro" is the screen that opens the stage. The texts are in `src/learn/i18n/he.json`. Stage and category names on the map are labels and are not checked.

## The order

| # | Term (Hebrew) | What the learner is told | Where |
|---|---|---|---|
| 1 | כלי | Shogi is a two-player board game; everything is taught here | מבוא, intro |
| 2 | לוח, משבצת | The board is 9 × 9 squares | מבוא 1 |
| 3 | יריב, הצד שלך | Both sides have the same colour; the point of a piece shows its owner | מבוא 1 |
| 4 | Piece letters מ צ רץ ז כ פ ח ר | Each piece has a letter; each gets its own stage. The set can be switched to English or kanji | מבוא 1 |
| 5 | שורה | A line of squares from right to left | מבוא 2 |
| 6 | אזור ההכתרה, הכתרה | The three far rows; a piece that gets there can flip over and become stronger | מבוא 2 |
| 7 | מהלך, תור | Players take turns; a move is moving one piece | מבוא 3 |
| 8 | פותח, משיב | Who moves first; the learner is always פותח | מבוא 3 |
| 9 | מלך (מ) | The most important piece; whoever's king is trapped loses (mate itself comes later) | מלך, intro |
| 10 | כוכב | Training targets, not part of the game; collect them by moving onto them | מלך 1 |
| 11 | גנרל, גנרל זהב (ז) | Two kinds of generals guard the king; that is where the name comes from | זהב, intro |
| 12 | ציון (fewer moves) | Fewer moves, higher score | זהב 2 |
| 13 | גנרל כסף (כ) | The second general; better in attack than gold | כסף, intro |
| 14 | כסף מוכתר (כ+) | Moves like a gold general | כסף 4 |
| 15 | ויתור על הכתרה | Promotion is a choice; saying no is always allowed | כסף 4, recap |
| 16 | פרש (פ), פרש מוכתר (פ+) | Jumps two forward and one aside; must promote in the last two rows | פרש, intro / 2 |
| 17 | רומח (ח), רומח מוכתר (ח+) | Goes straight forward as far as it likes; must promote in the last row | רומח, intro / 2 |
| 18 | רץ | Diagonals, any distance | רץ, intro |
| 19 | ביד, הצנחה | A piece beside the board is in your hand; placing it on an empty square is a drop. How pieces get there comes later | רץ 2 |
| 20 | סוס (ס) | Promoted bishop | רץ 3 |
| 21 | צריח (צ), טור | Straight lines; a file is a line from top to bottom | צריח, intro |
| 22 | דרקון (ד) | Promoted rook; promotion is allowed on any move that starts or ends in the zone | צריח 3 |
| 23 | רגלי (ר), טוקין (ר+) | One square forward; tokin moves like a gold general | רגלי, intro / 2 |
| 24 | לכידה, ללכוד | Moving onto an opponent's piece takes it off the board; in shogi it goes to your hand | לכידה, intro |
| 25 | מאוים | A square the opponent's pieces can reach | לכידה 2 |
| 26 | הצנחה (full rules) | Only on an empty square, only where the piece can move again, lands unpromoted | הצנחה 2 |
| 27 | רגלי כפול | Two unpromoted pawns on one file is illegal | הצנחה 8 |
| 28 | להגן, מוגן | If the opponent captures, you capture back | הגנה, intro |
| 29 | שח | The king is threatened and must be dealt with now | שח, intro |
| 30 | לחסום | Put a piece between the attacker and the king | יציאה משח, intro |
| 31 | מט | A check with no way out wins the game | מט, intro |
| 32 | מט בהצנחת רגלי | Illegal; a pushed pawn may mate | מט 12, 13 |
| 33 | פתיחה, אמצע המשחק, סוף המשחק | The three parts of every game | מט, intro (סוף המשחק) and closing text (all three) |
| 34 | עמדה פותחת, עמדה | How every game starts; a position is everything on the board and in hand, and whose turn it is | סידור הלוח 1, חזרה 1 |
| 35 | חזרה מרובעת, תיקו, שח נצחי | Same position four times is a draw; endless checks lose | חזרה, intro / 1 / 2 |

Setup and repetition come back with the course map PR. Until then the test skips them.

## What changed and why

- **Chess**: no beginner text compares to chess. Chess comparisons live only in the chess-player texts and in the "למי שבא משחמט" notes of the written rules lessons.
- **Piece names**: each piece is named once with its Hebrew board letter and its Japanese name, for example "צריח (צ; ביפנית 飛 hi)". English names are gone from the course text.
- **Previews**: a stage's closing text no longer names the next piece or rule ("next: the knight"). It describes it instead ("the only piece that jumps"), since the name has not been taught yet.
- **Recaps**: every exercise now ends with a short recap that says why the thing just practised matters, not just "you reached the goal".
- **Notation**: the board setup stage no longer uses square numbers or move codes (59, P-76). Square names are taught in written rules lesson 1. The openings category still uses move codes. It is not a beginner stage, and the course map PR decides where notation is taught.
- **Written rules lessons 1–6** are now optional "read more". Each beginner stage links its lesson on the start screen (`src/learn/read-more.ts`).

## How to test by hand

Open `/learn/`, choose the introduction, and play to the end of מט במהלך אחד as someone who knows nothing about shogi or chess. At each screen ask: did I meet any word here that nobody explained? Note the stage and exercise number of anything that fails.
