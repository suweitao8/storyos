import { describe, expect, it } from "vitest";
import { buildSourceAlignmentMessages, parseSourceMatches } from "./source-alignment.js";

describe("source alignment", () => {
  it("serializes each candidate frame as a low-detail image input", () => {
    const messages = buildSourceAlignmentMessages({
      anchor: { id: "a1", commentaryStartSeconds: 0, commentaryEndSeconds: 4, text: "主角推开地下室的门" },
      candidates: [{ id: "scene-1", startSeconds: 12, endSeconds: 18, thumbnailDataUrl: "data:image/jpeg;base64,AA==" }],
    });
    expect(messages[1]?.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image_url" }),
    ]));
  });

  it("drops model matches that point outside the supplied candidate windows", () => {
    expect(parseSourceMatches("{\"matches\":[{\"sceneId\":\"scene-1\",\"startSeconds\":70,\"endSeconds\":80,\"confidence\":0.9}]}", [
      { id: "scene-1", startSeconds: 12, endSeconds: 18, thumbnailDataUrl: "data:image/jpeg;base64,AA==" },
    ])).toEqual([]);
  });
});
