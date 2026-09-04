export function parseUsernames(text, limit = 100) {
  const values = String(text || "")
    .replace(/\r/g, "\n")
    .split(/[\n\t,;]+/)
    .map((value) => value.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  const seen = new Set();
  const unique = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
    if (unique.length >= limit) break;
  }

  return unique;
}

export function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

const BOSS_NAME_OVERRIDES = new Map([
  ["chambers_of_xeric_challenge_mode", "chambers_of_xeric_cm"],
  ["theatre_of_blood_hard_mode", "theatre_of_blood_hard_mode"],
  ["tombs_of_amascut_expert_mode", "tombs_of_amascut_expert"],
  ["the_corrupted_gauntlet", "the_corrupted_gauntlet"],
  ["tzkal_zuk", "tzkal_zuk"],
  ["tztok_jad", "tztok_jad"],
  ["kril_tsutsaroth", "kril_tsutsaroth"],
  ["kreearra", "kreearra"],
  ["phosanis_nightmare", "phosanis_nightmare"]
]);

export function canonicalBossName(value) {
  const normalized = normalizeName(value);
  return BOSS_NAME_OVERRIDES.get(normalized) || normalized;
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function roundMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function deriveTempleGamemode(gameModeRaw, gimRaw) {
  const gim = toNumber(gimRaw, 0);

  if (gim !== 0) {
    const code = String(gim);
    const typeDigit = code[0];
    const sizeDigit = code[1];
    let kind = "GIM";

    if (typeDigit === "1") kind = "Regular GIM";
    if (typeDigit === "2") kind = "Hardcore GIM";

    if (sizeDigit && /^\d$/.test(sizeDigit)) {
      return kind + " " + Number(sizeDigit) + "-player";
    }

    return kind;
  }

  const gameMode = toNumber(gameModeRaw, -1);
  return new Map([
    [0, "Main"],
    [1, "IM"],
    [2, "UIM"],
    [3, "HCIM"]
  ]).get(gameMode) || "Unknown";
}

export function templeModeKey(gameModeRaw, gimRaw) {
  const gim = toNumber(gimRaw, 0);
  if (gim !== 0) return "gim";

  const gameMode = toNumber(gameModeRaw, -1);
  if (gameMode === 1) return "ironman";
  if (gameMode === 2) return "ultimate";
  if (gameMode === 3) return "hardcore";
  if (gameMode === 0) return "main";
  return "unknown";
}

export function selectSpecialProfile(classification) {
  if (classification.build === "lvl3") return "lvl3";
  if (classification.build === "def1") return "def1";
  if (classification.mode === "ultimate") return "ultimate";
  if (classification.mode === "ironman" || classification.mode === "hardcore" || classification.mode === "gim") {
    return "ironman";
  }
  return null;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
