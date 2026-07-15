import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSourceTimeline } from "./source-timeline.js";

describe("source timeline", () => {
  it("extracts scenes whose ranges are ordered and inside the probed duration", async () => {
    const writtenArgs: string[][] = [];
    const outputDirectory = await mkdtemp(join(tmpdir(), "storyos-source-timeline-test-"));
    const timeline = await buildSourceTimeline("D:/film.mp4", {
      probe: async () => ({ durationSeconds: 90 }),
      runFfmpeg: async (args) => {
        writtenArgs.push([...args]);
      },
      outputDirectory,
      sampleEverySeconds: 10,
    });

    expect(timeline.sourceFileKey).toBe("sourceVideo");
    expect(timeline.scenes[0]).toMatchObject({ startSeconds: 0, endSeconds: 10 });
    expect(timeline.scenes.at(-1)).toMatchObject({ startSeconds: 80, endSeconds: 90 });
    expect(timeline.scenes.every((scene) => scene.endSeconds <= 90)).toBe(true);
    expect(writtenArgs[0]).toEqual(expect.arrayContaining(["-ss", "0", "-frames:v", "1"]));
  });
});
