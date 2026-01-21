/**
 * Generic IPC handler registration with input validation and a uniform
 * `{success, data}` / `{success: false, error}` envelope.
 *
 * Two registration helpers are exported:
 *   - `registerHandler` — validates input, wraps the result in an envelope.
 *   - `registerRawHandler` — validates input, returns the handler's value verbatim.
 *
 * Why two: the settings channels (get-settings, set-settings, ...) are still
 * consumed by `settingsSlice.ts`, which calls `ipcRenderer.invoke` directly and
 * expects the raw value back. Migrating settingsSlice is owned by a different
 * agent in a future PR, so we preserve its contract by registering settings
 * handlers with `registerRawHandler`.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ZodSchema } from 'zod';

export interface IpcSuccess<T> {
  success: true;
  data: T;
}

export interface IpcFailure {
  success: false;
  error: string;
  details?: unknown;
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure;

/**
 * Decide what to hand to zod's `safeParse` based on the raw arg arity.
 *
 * - 0 args -> undefined (use schemas like `z.undefined()` for these channels)
 * - 1 arg  -> the single value
 * - 2+ args -> the args array (use a `z.tuple([...])` schema for these channels)
 *
 * Mixed-arity is intentionally not supported: each channel has a fixed handler
 * signature in handlers.ts, so this matches reality without a per-channel switch.
 */
function pickRaw(rawArgs: unknown[]): unknown {
  if (rawArgs.length === 0) return undefined;
  if (rawArgs.length === 1) return rawArgs[0];
  return rawArgs;
}

/**
 * Register an envelope-wrapped handler.
 *
 * Renderer receives `{success: true, data}` on success or `{success: false, error}`
 * on validation/handler failure. The renderer's `ipc-client` unwraps this.
 */
export function registerHandler<I, O>(
  channel: string,
  schema: ZodSchema<I>,
  handler: (input: I, evt: IpcMainInvokeEvent) => Promise<O> | O,
): void {
  ipcMain.handle(channel, async (evt, ...rawArgs) => {
    const raw = pickRaw(rawArgs);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`IPC ${channel}: input validation failed`, parsed.error.flatten());
      const failure: IpcFailure = {
        success: false,
        error: 'INVALID_INPUT',
        details: parsed.error.flatten(),
      };
      return failure;
    }
    try {
      const data = await handler(parsed.data as I, evt);
      const success: IpcSuccess<O> = { success: true, data };
      return success;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`IPC handler ${channel} failed:`, e);
      const failure: IpcFailure = { success: false, error: message };
      return failure;
    }
  });
}

/**
 * Register a non-enveloped handler — input is still validated by zod, but the
 * handler's return value is returned to the renderer verbatim (no `{success, data}` wrap).
 *
 * Used for legacy settings channels that `settingsSlice.ts` consumes directly
 * via `ipcRenderer.invoke`. On validation failure, throws (which surfaces in the
 * renderer as a rejected invoke promise) so existing thunk error paths still fire.
 */
export function registerRawHandler<I, O>(
  channel: string,
  schema: ZodSchema<I>,
  handler: (input: I, evt: IpcMainInvokeEvent) => Promise<O> | O,
): void {
  ipcMain.handle(channel, async (evt, ...rawArgs) => {
    const raw = pickRaw(rawArgs);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`IPC ${channel}: input validation failed`, parsed.error.flatten());
      throw new Error(`INVALID_INPUT for ${channel}`);
    }
    try {
      return await handler(parsed.data as I, evt);
    } catch (e) {
      console.error(`IPC handler ${channel} failed:`, e);
      throw e;
    }
  });
}
