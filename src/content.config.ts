import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const rules = defineCollection({
  loader: glob({
    pattern: '*.mdx',
    base: './src/content/rules',
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    course: z.string().optional(),
    lesson: z.number(),
    next: z.string().optional(),
    status: z.string().optional(),
    reading_time_min: z.number().optional(),
    og_image_sfen: z.string().optional(),
  }).passthrough(),
});

export const collections = { rules };
