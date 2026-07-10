export type CraftTab = "list" | "create" | "detail";

export type CraftNavigationState = {
  tab: CraftTab;
  selectedCraftId: string | null;
};

export function resolveInitialCraftState(
  recentCraftId: string | null,
  availableCraftIds: ReadonlyArray<string>,
): CraftNavigationState {
  if (recentCraftId && availableCraftIds.includes(recentCraftId)) {
    return { tab: "detail", selectedCraftId: recentCraftId };
  }

  return { tab: "list", selectedCraftId: null };
}

export function resolveAfterCraftDelete(
  deletedCraftId: string,
  remainingCraftIds: ReadonlyArray<string>,
): CraftNavigationState {
  void deletedCraftId;

  const nextCraftId = remainingCraftIds.at(-1);
  if (nextCraftId) {
    return { tab: "detail", selectedCraftId: nextCraftId };
  }

  return { tab: "list", selectedCraftId: null };
}
