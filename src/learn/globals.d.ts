// Shogi Israel: the ambient types lila declares globally (ui/@types), needed by the ported files.
type Color = 'sente' | 'gote';
type Key = import('shogiground/types').Key;
type Usi = string;
type Sfen = string;
type Redraw = () => void;
