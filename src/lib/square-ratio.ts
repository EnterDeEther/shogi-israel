// Our squares are square (shogiground.css: aspect-ratio 1 / 1), but shogiground draws circles and arrows in an
// SVG whose viewBox assumes its upstream 11:12 squares. The SVG keeps that shape inside our square board, so it
// shrinks to the board's height and centres: every circle and arrow lands sideways off its square (up to a third
// of a square at the edge files, none at the middle file). Pass this as squareRatio to every Shogiground() so the
// drawing grid matches the squares. 11 keeps the stroke widths learn.css sets in these units.
import type { NumberPair } from 'shogiground/types';

export const SQUARE_RATIO: NumberPair = [11, 11];
