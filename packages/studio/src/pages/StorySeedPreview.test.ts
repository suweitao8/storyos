import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StorySeed } from "@actalk/inkos-core";
import { StorySeedPreview } from "./StorySeedPreview";

const seed: StorySeed = {
  title: "回声井",
  genreTone: "都市悬疑，冷峻克制",
  hook: "每晚两点，旧井会回放明天失踪者的最后一句话。",
  worldview: "城市的声音会在地下保存七天，只有守井人能听见。",
  characters: "林岚：守井人；周野：即将失踪的弟弟。",
  conflict: "林岚必须在救弟弟和暴露城市秘密之间选择。",
  outline: "1. 听见预告\n2. 追查旧井\n3. 交换记忆",
  reversals: "弟弟早已听见同一段回声。",
  ending: "林岚封井，却在雨后听见自己的声音。",
  visualAudioMotifs: "潮湿的蓝光、滴水声、远处的列车。",
};

describe("StorySeedPreview", () => {
  it("renders all story foundation sections and editable controls", () => {
    const html = renderToStaticMarkup(createElement(StorySeedPreview, {
      seed,
      streamedContent: "## 故事名称\n\n回声井",
      status: "ready",
      isZh: true,
      onChangeSeed: vi.fn(),
    }));

    expect(html).toContain("回声井");
    expect(html).toContain("世界观与运行规则");
    expect(html).toContain("画面与声音母题");
    expect(html).toContain("textarea");
    expect(html).toContain("已生成，可编辑后创建");
  });

  it("keeps the live markdown visible while generation is in progress", () => {
    const html = renderToStaticMarkup(createElement(StorySeedPreview, {
      seed: null,
      streamedContent: "## 故事名称\n\n正在生成",
      status: "generating",
      isZh: true,
      onChangeSeed: vi.fn(),
    }));

    expect(html).toContain("正在生成");
    expect(html).toContain("正在生成完整故事设定");
  });
});
