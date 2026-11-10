// AGPL-3.0-or-later, like the rest of this site.
export const friendOn = (): boolean =>
  process.env.VERCEL_ENV !== 'production' || process.env.FRIEND_PLAY === '1';
