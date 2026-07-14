import { describe, expect, it } from "vitest";

import {
  SOFT_DELETE_RETENTION_MS,
  isSoftDeleteExpired,
  sortSoftDeletedLast,
} from "../utils/soft-delete.js";

describe("soft delete lifecycle helpers", () => {
  it("expires an item exactly after the 72-hour retention window", () => {
    const deletedAt = "2026-07-10T00:00:00.000Z";
    const beforeExpiry = Date.parse(deletedAt) + SOFT_DELETE_RETENTION_MS - 1;
    const atExpiry = Date.parse(deletedAt) + SOFT_DELETE_RETENTION_MS;

    expect(isSoftDeleteExpired(deletedAt, beforeExpiry)).toBe(false);
    expect(isSoftDeleteExpired(deletedAt, atExpiry)).toBe(true);
  });

  it("sorts active items first and trash items last", () => {
    const records = [
      { id: "trash-old", deletedAt: "2026-07-01T00:00:00.000Z" },
      { id: "active" },
      { id: "trash-new", deletedAt: "2026-07-02T00:00:00.000Z" },
    ];

    expect(sortSoftDeletedLast(records).map((record) => record.id)).toEqual([
      "active",
      "trash-new",
      "trash-old",
    ]);
  });
});
