import { describe, expect, it } from "vitest";
import {
  serializeLLMContentForAnthropic,
  serializeLLMContentForChat,
  serializeLLMContentForResponses,
  type LLMMessageContent,
} from "../llm/provider.js";

const content: LLMMessageContent = [
  { type: "text", text: "请判断这张原片关键帧对应的场景。" },
  { type: "image_url", image_url: { url: "data:image/jpeg;base64,AA==", detail: "low" } },
];

describe("multimodal LLM messages", () => {
  it("serializes text-only content without changing its shape", () => {
    expect(serializeLLMContentForChat("普通文本")).toBe("普通文本");
  });

  it("serializes an image part for chat, responses, and anthropic transports", () => {
    expect(serializeLLMContentForChat(content)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image_url" }),
    ]));
    expect(serializeLLMContentForResponses(content)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "input_image", image_url: "data:image/jpeg;base64,AA==" }),
    ]));
    expect(serializeLLMContentForAnthropic(content)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image", source: expect.objectContaining({ type: "base64" }) }),
    ]));
  });
});
