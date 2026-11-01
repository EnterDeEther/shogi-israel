// AGPL-3.0-or-later, like the rest of src/learn/.
export const stageSlug = (key: string): string => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export const stageUrl = (key: string): string => `/learn/${stageSlug(key)}/`;
