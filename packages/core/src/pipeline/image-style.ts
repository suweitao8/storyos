import {
  DEFAULT_IMAGE_STYLES,
} from "../models/default-prompt-templates.js";
import type { ArtStyle, ImagePromptKind } from "../models/genre-profile.js";

export function resolveImageStyleDescription(
  kind: ImagePromptKind,
  artStyle: ArtStyle = "realistic",
): string {
  return DEFAULT_IMAGE_STYLES[artStyle][kind];
}

export function appendImageStylePrompt(
  prompt: string,
  kind: ImagePromptKind,
  artStyle: ArtStyle = "realistic",
): string {
  const content = prompt.trim();
  const style = resolveImageStyleDescription(kind, artStyle).trim();
  if (!style) return content;
  if (content.includes("统一画面风格：") || content.includes(style)) return content;
  return content
    ? `${content}\n\n统一画面风格：${style}`
    : `统一画面风格：${style}`;
}
