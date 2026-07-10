import type { CraftBreakdownModule, CraftProfile } from "../models/craft-profile.js";

type CraftModuleCategory = CraftBreakdownModule["category"];

const CATEGORY_LABELS: Record<"zh" | "en", Record<CraftModuleCategory, string>> = {
  zh: {
    opening: "开篇钩子",
    chapterFlow: "章节推进",
    sceneRhythm: "场景与节奏",
    disclosure: "信息释放",
    suspense: "悬念管理",
    perspective: "视角与叙述",
    emotion: "情绪推进",
    turningPoint: "转折与回收",
    other: "其他模块",
  },
  en: {
    opening: "Opening Hook",
    chapterFlow: "Chapter Flow",
    sceneRhythm: "Scene & Rhythm",
    disclosure: "Information Release",
    suspense: "Suspense Control",
    perspective: "Perspective",
    emotion: "Emotional Arc",
    turningPoint: "Turning Point",
    other: "Other",
  },
};

function normalizeCategory(value: string): CraftModuleCategory {
  const normalized = value.trim().toLowerCase();
  if (["opening", "openinghook", "opening_hook", "open", "开篇", "开篇钩子", "开头"].includes(normalized)) return "opening";
  if (["chapter", "chapterflow", "chapterarc", "chapter_arc", "章节", "章节推进", "章节弧线"].includes(normalized)) return "chapterFlow";
  if (["scenerhythm", "scene_rhythm", "rhythm", "场景", "场景与节奏", "场景节奏"].includes(normalized)) return "sceneRhythm";
  if (["disclosure", "information", "informationdisclosure", "信息", "信息披露", "信息释放"].includes(normalized)) return "disclosure";
  if (["suspense", "悬念", "悬念管理"].includes(normalized)) return "suspense";
  if (["perspective", "pov", "视角", "叙事视角"].includes(normalized)) return "perspective";
  if (["emotion", "emotional", "emotionarc", "情绪", "情绪推进"].includes(normalized)) return "emotion";
  if (["turningpoint", "turning_point", "hook", "转折", "转折与回收", "章末钩子"].includes(normalized)) return "turningPoint";
  return "other";
}

export function normalizeCraftBreakdownModule(raw: unknown): CraftBreakdownModule | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const label = String(item.label ?? item.title ?? item.name ?? item.标题 ?? item.标签 ?? item.名称 ?? "").trim();
  const summary = String(item.summary ?? item.description ?? item.text ?? item.描述 ?? item.说明 ?? item.摘要 ?? item.概述 ?? "").trim();
  if (!label || !summary) return null;

  const evidence = String(item.evidence ?? item.excerpt ?? item.quote ?? item.quoteText ?? item.content ?? item.证据 ?? item.原文 ?? "").trim();
  const category = normalizeCategory(String(item.category ?? item.type ?? item.section ?? item.分类 ?? ""));

  return {
    category,
    label,
    summary,
    evidence: evidence || undefined,
  };
}

export function normalizeCraftBreakdownModules(raw: unknown): CraftBreakdownModule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeCraftBreakdownModule(item))
    .filter((item): item is CraftBreakdownModule => item !== null);
}

function pushModule(
  modules: CraftBreakdownModule[],
  category: CraftModuleCategory,
  label: string,
  summary: string,
  evidence?: string,
): void {
  const trimmedSummary = summary.trim();
  if (!trimmedSummary) return;
  const trimmedEvidence = evidence?.trim();
  modules.push({
    category,
    label,
    summary: trimmedSummary,
    evidence: trimmedEvidence || undefined,
  });
}

export function deriveCraftBreakdownModules(profile: CraftProfile): CraftBreakdownModule[] {
  const normalizedModules = normalizeCraftBreakdownModules(profile.modules);
  if (normalizedModules.length > 0) return normalizedModules;

  const modules: CraftBreakdownModule[] = [];
  const structureEvidence = profile.structure.exemplar;
  const rhythmEvidence = profile.sceneRhythm.exemplar;
  const disclosureEvidence = profile.informationDisclosure.exemplar;
  const perspectiveEvidence = profile.narrativePerspective.exemplar;

  pushModule(modules, "opening", "开篇钩子", profile.structure.openingPattern, structureEvidence);
  pushModule(modules, "chapterFlow", "章节推进", profile.structure.chapterArc, structureEvidence);
  pushModule(modules, "turningPoint", "章末钩子", profile.structure.endingHookType, structureEvidence);

  pushModule(modules, "sceneRhythm", "场景切换", profile.sceneRhythm.sceneTransitionTechnique, rhythmEvidence);
  pushModule(modules, "sceneRhythm", "节奏曲线", profile.sceneRhythm.pacingCurve, rhythmEvidence);
  pushModule(modules, "turningPoint", "冲突升级", profile.sceneRhythm.conflictEscalation, rhythmEvidence);

  pushModule(modules, "disclosure", "伏笔密度", profile.informationDisclosure.foreshadowingDensity, disclosureEvidence);
  pushModule(modules, "disclosure", "信息释放", profile.informationDisclosure.informationReleaseRhythm, disclosureEvidence);
  pushModule(modules, "suspense", "悬念管理", profile.informationDisclosure.suspenseManagement, disclosureEvidence);

  pushModule(modules, "perspective", "视角策略", profile.narrativePerspective.povStrategy, perspectiveEvidence);
  pushModule(modules, "perspective", "叙述与对话比例", profile.narrativePerspective.narrationDialogueRatio, perspectiveEvidence);
  pushModule(modules, "perspective", "叙事距离", profile.narrativePerspective.narrativeDistance, perspectiveEvidence);

  return modules;
}

export function formatCraftBreakdownModules(profile: CraftProfile, language: "zh" | "en"): string {
  const modules = deriveCraftBreakdownModules(profile);
  if (modules.length === 0) return "";

  const labelLookup = CATEGORY_LABELS[language];
  const lines = ["## 拆文模块", ""];
  for (const module of modules) {
    const categoryLabel = labelLookup[module.category];
    lines.push(`- ${categoryLabel} / ${module.label}: ${module.summary}`);
    if (module.evidence) {
      lines.push(`  - ${language === "zh" ? "证据" : "Evidence"}: ${module.evidence}`);
    }
  }
  return lines.join("\n");
}
