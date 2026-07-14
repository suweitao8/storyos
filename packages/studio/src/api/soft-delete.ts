export const SOFT_DELETE_RETENTION_MS = 72 * 60 * 60 * 1000;

export interface SoftDeletable {
  readonly deletedAt?: string;
}

export function isSoftDeleteExpired(deletedAt: string | undefined, now = Date.now()): boolean {
  if (!deletedAt) return false;
  const deletedTime = Date.parse(deletedAt);
  return Number.isFinite(deletedTime) && now - deletedTime >= SOFT_DELETE_RETENTION_MS;
}

export function sortSoftDeletedLast<T extends SoftDeletable>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...items].sort((left, right) => {
    const leftDeleted = Boolean(left.deletedAt);
    const rightDeleted = Boolean(right.deletedAt);
    if (leftDeleted !== rightDeleted) return leftDeleted ? 1 : -1;
    return 0;
  });
}
