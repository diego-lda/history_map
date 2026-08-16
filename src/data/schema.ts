import { z } from 'zod'
import { LOCATION_TYPE_KEYS } from './locationTypes.ts'

/**
 * The shape of one entry file in data/entries/.
 *
 * This is the single source of truth for the data model: the app's TypeScript
 * types are inferred from it, and scripts/validate.ts runs it over every file
 * before the site is allowed to build.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case (a-z, 0-9, hyphens)')

/** ISO 8601 date, either YYYY-MM-DD or YYYY-MM when the memory is fuzzy. */
const entryDate = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'must be YYYY-MM-DD or YYYY-MM')
  .refine((value) => !Number.isNaN(Date.parse(fullDate(value))), 'is not a real date')
  .refine((value) => Date.parse(fullDate(value)) <= Date.now(), 'is in the future')

/** YYYY-MM -> YYYY-MM-01, so partial dates can still be parsed and sorted. */
export function fullDate(value: string): string {
  return value.length === 7 ? `${value}-01` : value
}

const localMedia = z.object({
  file: z.string().min(1),
  caption: z.string().optional(),
  alt: z.string().optional(),
})

const youtubeMedia = z.object({
  youtube: z.string().min(1),
  caption: z.string().optional(),
})

const vimeoMedia = z.object({
  vimeo: z.string().min(1),
  caption: z.string().optional(),
})

export const MediaSchema = z.union([localMedia, youtubeMedia, vimeoMedia])

export const EntrySchema = z.object({
  id: slug,
  title: z.string().min(1),

  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  })
    // 0,0 is in the Gulf of Guinea. Nobody has been there; it means a
    // coordinate was left blank or failed to parse.
    .refine((c) => !(c.lat === 0 && c.lon === 0), 'is 0,0 — a missing coordinate'),

  date: entryDate,
  type: z.enum(LOCATION_TYPE_KEYS),
  description: z.string().min(1),

  opinion: z.string().optional(),
  place: z
    .object({
      city: z.string().optional(),
      country: z.string().optional(),
      country_code: z
        .string()
        .regex(/^[A-Z]{2}$/, 'must be an uppercase ISO 3166-1 alpha-2 code')
        .optional(),
    })
    .optional(),
  rating: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/, 'must be lowercase')).optional(),
  media: z.array(MediaSchema).optional(),
  links: z.array(z.object({ label: z.string().min(1), url: z.url() })).optional(),
})

export type Entry = z.infer<typeof EntrySchema>
export type Media = z.infer<typeof MediaSchema>

export const isLocalMedia = (m: Media): m is z.infer<typeof localMedia> => 'file' in m
export const isYouTube = (m: Media): m is z.infer<typeof youtubeMedia> => 'youtube' in m
export const isVimeo = (m: Media): m is z.infer<typeof vimeoMedia> => 'vimeo' in m
