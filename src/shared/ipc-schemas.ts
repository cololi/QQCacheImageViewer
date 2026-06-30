/**
 * Zod input schemas for every invocable IPC channel.
 *
 * Each schema describes the payload shape the registry will pass to the handler.
 * Schemas for multi-positional-arg invokes are tuples — the registry collects
 * `...rawArgs` into a tuple when there are 2+ args; for single args it passes
 * `rawArgs[0]`. Channels with no args use `NoInput` (z.undefined()).
 */
import { z } from 'zod';

// ---- Reusable atoms -------------------------------------------------------

/** Schema for invokes with no arguments (rawArgs[0] === undefined). */
export const NoInput = z.undefined();

const NumberRange = z.tuple([z.number(), z.number()]);

// ---- Scanning + metadata --------------------------------------------------

export const ScanImagesInput = z
  .object({
    paths: z.array(z.string()).optional(),
    incremental: z.boolean().optional(),
    includeTemp: z.boolean().optional(),
  })
  .default({});

export const GetImagesInput = z.object({
  yearMonth: z.string().optional(),
  format: z.string().optional(),
  formats: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  sizeRange: NumberRange.optional(),
  ratioRange: NumberRange.optional(),
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  // Renderer historically passes 0 for offset on first page; allow 0.
  offset: z.number().int().min(0).optional(),
  // db-service clamps to MAX_QUERY_LIMIT (500) anyway; keep schema generous but bounded.
  limit: z.number().int().min(1).max(500).optional(),
});

export const GetImageCountInput = z.string().optional();

// ---- File operations ------------------------------------------------------

/** [source, destination] */
export const CopyFileInput = z.tuple([z.string(), z.string()]);

/** [sources[], destinationFolder] */
export const CopyFilesInput = z.tuple([z.array(z.string()), z.string()]);

/** filePaths[] */
export const DeleteToRecycleBinInput = z.array(z.string());

/** ids[] (database row ids) */
export const DeleteImagesInput = z.array(z.number().int());

/** yearMonth string */
export const DeleteMonthImagesInput = z.string();

/**
 * [images[], outputPath]
 * Image objects pass through as-is — they were produced by main and round-trip back.
 */
export const ExportAsZipInput = z.tuple([z.array(z.any()), z.string()]);

export const OpenFolderInput = z.string();
export const OpenFileInput = z.string();

/**
 * Single image object (round-tripped from main; loose validation since shape comes from us).
 */
export const SaveImageInput = z
  .object({
    hash: z.string(),
    format: z.string(),
    filePath: z.string(),
  })
  .passthrough();

// ---- Dialogs --------------------------------------------------------------

/** [title, defaultFileName, filters?] */
export const ShowSaveDialogInput = z.tuple([
  z.string(),
  z.string(),
  z
    .array(
      z.object({
        name: z.string(),
        extensions: z.array(z.string()),
      }),
    )
    .optional(),
]);

/** title */
export const ShowOpenDirectoryDialogInput = z.string();

// ---- Settings -------------------------------------------------------------
// These channels use envelope=false in the registry to preserve back-compat
// with settingsSlice (which calls ipcRenderer.invoke directly and expects raw values).

export const GetSettingsInput = NoInput;

/** Full AppSettings object — passed through to the service which validates. */
export const SetSettingsInput = z.record(z.unknown());

/** preference key */
export const GetPreferenceInput = z.string();

/** [key, value] */
export const SetPreferenceInput = z.tuple([z.string(), z.unknown()]);

/** Partial<UserPreferences> */
export const UpdatePreferencesInput = z.record(z.unknown());

export const ResetSettingsInput = NoInput;
