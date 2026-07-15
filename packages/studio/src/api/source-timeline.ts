import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import type { SourceScene, SourceTimeline } from "@actalk/inkos-core";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export interface SourceTimelineDeps {
  readonly probe: (videoPath: string) => Promise<{ readonly durationSeconds: number }>;
  readonly runFfmpeg: (args: ReadonlyArray<string>) => Promise<void>;
  readonly outputDirectory: string;
  readonly sampleEverySeconds?: number;
}

export interface FfmpegSourceTimelineDeps {
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
}

const DEFAULT_FFMPEG_PATH = "C:\\ffmpeg\\bin\\ffmpeg.exe";

export async function probeVideoDuration(
  videoPath: string,
  ffprobePath = process.env.FFPROBE_PATH ?? DEFAULT_FFMPEG_PATH.replace(/ffmpeg\.exe$/u, "ffprobe.exe"),
): Promise<{ readonly durationSeconds: number }> {
  const result = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { windowsHide: true });
  const durationSeconds = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Unable to determine original video duration");
  }
  return { durationSeconds };
}

export async function runFfmpegFrame(
  args: ReadonlyArray<string>,
  ffmpegPath = process.env.FFMPEG_PATH ?? DEFAULT_FFMPEG_PATH,
): Promise<void> {
  await execFileAsync(ffmpegPath, [...args], { windowsHide: true });
}

export function createFfmpegSourceTimelineDeps(
  outputDirectory: string,
  options: FfmpegSourceTimelineDeps = {},
): SourceTimelineDeps {
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? DEFAULT_FFMPEG_PATH;
  const ffprobePath = options.ffprobePath ?? process.env.FFPROBE_PATH ?? DEFAULT_FFMPEG_PATH.replace(/ffmpeg\.exe$/u, "ffprobe.exe");
  return {
    outputDirectory,
    probe: (videoPath) => probeVideoDuration(videoPath, ffprobePath),
    runFfmpeg: (args) => runFfmpegFrame(args, ffmpegPath),
  };
}

export async function buildSourceTimeline(videoPath: string, deps: SourceTimelineDeps): Promise<SourceTimeline> {
  const { durationSeconds } = await deps.probe(videoPath);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Original video duration must be a positive finite number");
  }

  const sampleEverySeconds = Math.max(1, deps.sampleEverySeconds ?? 8);
  const frameDirectory = join(deps.outputDirectory, "frames");
  await mkdir(frameDirectory, { recursive: true });

  const scenes: SourceScene[] = [];
  for (let startSeconds = 0; startSeconds < durationSeconds; startSeconds += sampleEverySeconds) {
    const boundedStart = roundSeconds(startSeconds);
    const boundedEnd = roundSeconds(Math.min(durationSeconds, startSeconds + sampleEverySeconds));
    if (boundedEnd <= boundedStart) continue;
    const sceneNumber = scenes.length + 1;
    const frameName = `scene-${String(sceneNumber).padStart(4, "0")}.jpg`;
    const outputPath = join(frameDirectory, frameName);
    await deps.runFfmpeg([
      "-y",
      "-ss", String(boundedStart),
      "-i", videoPath,
      "-frames:v", "1",
      "-vf", "scale=640:-2",
      "-q:v", "3",
      outputPath,
    ]);
    scenes.push({
      id: `scene-${sceneNumber}`,
      startSeconds: boundedStart,
      endSeconds: boundedEnd,
      thumbnailFile: `frames/${frameName}`,
      visualSummary: "",
    });
  }

  return {
    version: 1,
    sourceFileKey: "sourceVideo",
    durationSeconds: roundSeconds(durationSeconds),
    scenes,
  };
}

function roundSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}
