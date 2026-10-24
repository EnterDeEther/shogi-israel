// Shogi Israel: each stage has its own page, /learn/<slug>/ (#level). Slug = stage key in kebab case
// ("outOfCheck" -> "out-of-check"), so the address is readable and can be shared on social posts.
// AGPL-3.0-or-later, like the rest of src/learn/.
export const stageSlug = (key: string): string => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export const stageUrl = (key: string): string => `/learn/${stageSlug(key)}/`;
