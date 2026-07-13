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

const BILIBILI_PACKAGING_SUFFIX = /(?:\s*(?:超长|完整|全|大)?合集|\s*全集|\s*悬疑动画|\s*动画解说|\s*电影解说|\s*剧情解说|\s*解说)\s*$/iu;

function trimBilibiliPackaging(value: string): string {
  let result = value
    .replace(/^[\s:：|｜\-]+/u, "")
    .replace(/[！!。．…，,、:：|｜]+$/u, "")
    .trim();

  const leadPattern = /^(?:(?:\d+|[一二三四五六七八九十百千万]+)\s*分钟)?\s*(?:半口气|一口气|几分钟)?\s*(?:看完|看懂|讲完|速看|解说|带你看)\s*[:：|｜\-]?\s*/u;
  result = result.replace(leadPattern, "").trim();

  for (let index = 0; index < 3; index += 1) {
    const next = result.replace(BILIBILI_PACKAGING_SUFFIX, "").trim();
    if (next === result) break;
    result = next;
  }

  return result.replace(/[！!。．…，,、:：|｜]+$/u, "").trim();
}

/** Convert a Bilibili marketing title into the referenced work's short name. */
export function normalizeBilibiliCraftName(value: string): string {
  const normalized = normalizeCraftDisplayName(value);
  const bracketed = normalized.match(/《\s*([^》]+?)\s*》|「\s*([^」]+?)\s*」|『\s*([^』]+?)\s*』|【\s*([^】]+?)\s*】|\[\s*([^\]]+?)\s*\]/u);
  const bracketTitle = bracketed?.slice(1).find((candidate) => candidate?.trim())?.trim();
  if (bracketTitle) {
    const cleanedBracketTitle = trimBilibiliPackaging(bracketTitle);
    if (cleanedBracketTitle && !BILIBILI_PACKAGING_SUFFIX.test(cleanedBracketTitle)) return cleanedBracketTitle;
  }

  return trimBilibiliPackaging(normalized) || normalized;
}
