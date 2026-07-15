import { describe, expect, it } from "vitest";
import { appendImageStylePrompt } from "../pipeline/image-style.js";

describe("image style prompt composition", () => {
  it("appends the selected 3D art style to an image prompt", () => {
    const prompt = appendImageStylePrompt("老旧居民楼的昏暗楼道", "scene", "cg3d");

    expect(prompt).toContain("老旧居民楼的昏暗楼道");
    expect(prompt).toContain("3D国漫风格");
  });

  it("does not duplicate a style already present in a prompt", () => {
    const style = "3D国漫风格，高质量CG影视画面渲染，人物建模精细，场景层次丰富。";
    const prompt = appendImageStylePrompt(`镜头内容\n\n统一画面风格：${style}`, "shot", "cg3d");

    expect(prompt.match(/3D国漫风格/gu)).toHaveLength(1);
  });
});
