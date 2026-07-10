export type CraftTab = "list" | "create" | "detail";

export type CraftNavigationState = {
  tab: CraftTab;
  selectedCraftId: string | null;
};

function isValidCraftId(craftId: string): boolean {
  return craftId.trim().length > 0;
}

export function resolveInitialCraftState(
  recentCraftId: string | null,
  availableCraftIds: ReadonlyArray<string>,
): CraftNavigationState {
  if (
    recentCraftId &&
    isValidCraftId(recentCraftId) &&
    availableCraftIds.includes(recentCraftId)
  ) {
    return { tab: "detail", selectedCraftId: recentCraftId };
  }

  return { tab: "list", selectedCraftId: null };
}

export function resolveAfterCraftDelete(
  deletedCraftId: string,
  remainingCraftIds: ReadonlyArray<string>,
): CraftNavigationState {
  const nextCraftId = remainingCraftIds.find(
    (craftId) => isValidCraftId(craftId) && craftId !== deletedCraftId,
  );
  if (nextCraftId !== undefined) {
    return { tab: "detail", selectedCraftId: nextCraftId };
  }

  return { tab: "list", selectedCraftId: null };
}
