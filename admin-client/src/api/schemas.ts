import { __ } from '@wordpress/i18n';
import { z } from 'zod';

/*
 * Client-side mirrors of the PHP JSON schemas.
 *   Settings → plugin/src/Settings/Settings.php
 *   Item     → plugin/src/Rest/ItemsController.php
 *   Status   → plugin/src/Rest/StatusController.php
 * PHP remains the source of truth; these validate responses and power forms.
 * Custom messages use __(); zod's default messages follow the locale (lib/i18n.ts).
 */

export const SettingsSchema = z.object({
  welcomeMessage: z.string().max(200, __('Keep it under 200 characters.', 'wp-plugin-starter')),
  itemsPerPage: z.number().int().min(1).max(100),
  mode: z.enum(['simple', 'advanced']),
  deleteDataOnUninstall: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ItemStatusSchema = z.enum(['draft', 'published']);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

/** Translated labels for enum values, shared by selects and badges. */
export const itemStatusLabels = (): Record<ItemStatus, string> => ({
  draft: __('Draft', 'wp-plugin-starter'),
  published: __('Published', 'wp-plugin-starter'),
});

export const ItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  content: z.string(),
  status: ItemStatusSchema,
  authorId: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Item = z.infer<typeof ItemSchema>;

/** What the create/edit form submits. */
export const ItemInputSchema = z.object({
  title: z.string().trim().min(1, __('Title is required.', 'wp-plugin-starter')).max(191),
  content: z.string(),
  status: ItemStatusSchema,
});
export type ItemInput = z.infer<typeof ItemInputSchema>;

export const DeleteResponseSchema = z.object({
  deleted: z.literal(true),
  previous: ItemSchema,
});

const RequirementSchema = z.object({
  /** Minimum version from the plugin header; empty when none is declared. */
  required: z.string(),
  ok: z.boolean(),
});

export const StatusSchema = z.object({
  plugin: z.object({
    version: z.string(),
    dbVersion: z.string(),
    dbVersionInstalled: z.string().nullable(),
    assetMode: z.enum(['dev', 'build']),
    itemsTable: z.object({ exists: z.boolean(), rows: z.number().int() }),
  }),
  wordpress: z.object({
    version: z.string(),
    requirement: RequirementSchema,
    siteUrl: z.string(),
    homeUrl: z.string(),
    multisite: z.boolean(),
    locale: z.string(),
    timezone: z.string(),
    environment: z.string(),
    debug: z.boolean(),
    memoryLimit: z.string(),
    permalinks: z.string(),
    theme: z.object({ name: z.string(), version: z.string() }),
    activePlugins: z.number().int(),
    cronDisabled: z.boolean(),
  }),
  server: z.object({
    phpVersion: z.string(),
    requirement: RequirementSchema,
    sapi: z.string(),
    software: z.string(),
    memoryLimit: z.string(),
    maxExecutionTime: z.string(),
    uploadMaxFilesize: z.string(),
    postMaxSize: z.string(),
    // PHP encodes an empty array as [], but the extension list is never empty.
    extensions: z.record(z.string(), z.boolean()),
  }),
  database: z.object({
    type: z.enum(['MySQL', 'MariaDB']),
    version: z.string(),
    prefix: z.string(),
    charset: z.string(),
    collate: z.string(),
  }),
});
export type Status = z.infer<typeof StatusSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;

/** Turn zod issues into { field: message } for form controls. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}
