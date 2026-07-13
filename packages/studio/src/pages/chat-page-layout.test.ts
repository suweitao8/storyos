import { describe, expect, it } from "vitest";
import { CHAT_LAYOUT_CLASSES } from "./ChatPage";

describe("chat workspace layout", () => {
  it("shares a wide content rail for messages, quick actions, and composer", () => {
    expect(CHAT_LAYOUT_CLASSES.content).toContain("max-w-[1100px]");
    expect(CHAT_LAYOUT_CLASSES.quickActions).toBe(CHAT_LAYOUT_CLASSES.content);
    expect(CHAT_LAYOUT_CLASSES.composer).toBe(CHAT_LAYOUT_CLASSES.content);
  });
});
