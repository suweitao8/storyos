import { z } from "zod";
import { PlayModeSchema, type PlayMode } from "./session.js";

export const ActionSourceSchema = z.enum(["free-text", "button", "slash", "quick-action"]);
export type ActionSource = z.infer<typeof ActionSourceSchema>;

export const RequestedIntentSchema = z.enum([
  "create_book",
  "write_next",
  "short_run",
  "play_start",
  "play_step",
  "generate_cover",
  "edit_artifact",
  "fanfic_init",
  "continuation_import",
  "spinoff_create",
  "style_imitation",
]);
export type RequestedIntent = z.infer<typeof RequestedIntentSchema>;

export function normalizeActionSource(value: unknown): ActionSource {
  if (value === undefined || value === null || value === "") return "free-text";
  return ActionSourceSchema.parse(value);
}

export function normalizeRequestedIntent(value: unknown): RequestedIntent | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return RequestedIntentSchema.parse(value);
}

export function normalizePlayMode(value: unknown): PlayMode | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return PlayModeSchema.parse(value);
}

export function isWriteNextInstruction(
  instruction: string,
  options: { readonly allowSlashWrite?: boolean } = {},
): boolean {
  const trimmed = instruction.trim();
  const pattern = options.allowSlashWrite
    ? /^(\/write|continue|继续|继续写|写下一章|write next|下一章|再来一章)$/i
    : /^(continue|继续|继续写|写下一章|write next|下一章|再来一章)$/i;
  return pattern.test(trimmed);
}
