import { think } from './lite';

self.onmessage = (e: MessageEvent<{ id: number; sfen: string; moves: string[]; level: number }>) => {
  const { id, sfen, moves, level } = e.data;
  try {
    self.postMessage({ id, usi: think(sfen, moves, level) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
