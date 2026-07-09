export function normalizeCraftDisplayName(value: string): string {
  const decodedValue = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();

  return decodedValue
    .replace(/(?:[_\-\s]+)(\d{1,4})$/g, "")
    .trim();
}
