import { algorithms, knownBosses } from "./vendor/wom/index.js";
import { REAL_SKILLS } from "./vendor/wom/types.js";
import {
  canonicalBossName,
  normalizeName,
  roundMetric,
  selectSpecialProfile,
  toNumber,
  xpToLevel
} from "./utils.js";

export const EXPORT_SUMMARY_COLUMNS = [
  "Username",
  "Gamemode",
  "EHP",
  "Special EHP",
  "EHB",
  "Special EHB"
];

export const VIEW_COLUMNS = [
  ...EXPORT_SUMMARY_COLUMNS,
  "Build",
  "Source",
  "Total Level",
  "Total XP",
  "Status"
];

const SKILL_LABELS = new Map([
  ["runecrafting", "Runecrafting"],
  ["hitpoints", "Hitpoints"]
]);

function labelize(value) {
  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function skillLabel(skill) {
  return SKILL_LABELS.get(skill) || labelize(skill);
}

function makeExperienceMap(hiscore) {
  return new Map(
    REAL_SKILLS.map((skill) => [skill, Math.max(0, toNumber(hiscore.skills?.[skill]?.xp, 0))])
  );
}

function makeKillcountMap(hiscore) {
  const map = new Map(knownBosses.map((boss) => [boss, 0]));

  for (const activity of Object.values(hiscore.activities || {})) {
    const key = canonicalBossName(activity.name);
    if (!map.has(key)) continue;
    map.set(key, Math.max(0, toNumber(activity.score, 0)));
  }

  return map;
}

function getHiscoreTotalLevel(hiscore) {
  const total = toNumber(hiscore.skills?.overall?.level, 0);
  if (total > 0) return total;

  return REAL_SKILLS.reduce(
    (sum, skill) => sum + Math.max(0, toNumber(hiscore.skills?.[skill]?.level, 0)),
    0
  );
}

function getHiscoreTotalXp(hiscore) {
  const total = toNumber(hiscore.skills?.overall?.xp, 0);
  if (total > 0) return total;

  return REAL_SKILLS.reduce(
    (sum, skill) => sum + Math.max(0, toNumber(hiscore.skills?.[skill]?.xp, 0)),
    0
  );
}

function buildHiscoreRaw(hiscore) {
  const raw = {};

  for (const skill of REAL_SKILLS) {
    const data = hiscore.skills?.[skill];
    const label = skillLabel(skill);
    raw[label + " Level"] = data ? toNumber(data.level, 0) : "";
    raw[label + " XP"] = data ? toNumber(data.xp, 0) : "";
  }

  const activities = Object.values(hiscore.activities || {}).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  for (const activity of activities) {
    raw[activity.name + " Score"] = toNumber(activity.score, 0);
  }

  return raw;
}

function metricFromTemple(stats, key) {
  const direct = stats?.[key];
  if (direct !== undefined && direct !== null && direct !== "") {
    return roundMetric(direct);
  }

  const wanted = normalizeName(key);
  for (const [candidate, value] of Object.entries(stats || {})) {
    if (normalizeName(candidate) === wanted) {
      return roundMetric(value);
    }
  }

  return 0;
}

function firstNonZero(...values) {
  for (const value of values) {
    const number = roundMetric(value);
    if (number !== 0) return number;
  }
  return 0;
}

function templeValue(stats, names) {
  const lookup = new Map(
    Object.entries(stats || {}).map(([key, value]) => [normalizeName(key), value])
  );

  for (const name of names) {
    const value = lookup.get(normalizeName(name));
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return undefined;
}

function buildTempleRaw(stats) {
  const raw = {};
  const seen = new Set();

  for (const skill of REAL_SKILLS) {
    const names = skill === "runecrafting"
      ? ["Runecrafting", "Runecraft"]
      : [skillLabel(skill)];

    const level = templeValue(stats, names.flatMap((name) => [name + "_level", name + " level"]));
    const xp = templeValue(stats, names);

    if (xp !== undefined) {
      const xpNumber = toNumber(xp, 0);
      raw[skillLabel(skill) + " XP"] = xpNumber;
      raw[skillLabel(skill) + " Level"] = level !== undefined
        ? toNumber(level, 0)
        : xpToLevel(xpNumber);
      seen.add(normalizeName(names[0]));
      seen.add(normalizeName(names[0] + "_level"));
    } else if (level !== undefined) {
      raw[skillLabel(skill) + " Level"] = toNumber(level, 0);
      seen.add(normalizeName(names[0] + "_level"));
    }
  }

  const excluded = new Set([
    "ehp",
    "im_ehp",
    "lvl3_ehp",
    "uim_ehp",
    "1def_ehp",
    "gim_ehp",
    "ehb",
    "im_ehb",
    "uim_ehb",
    "1def_ehb",
    "date",
    "timestamp",
    "player",
    "username",
    "primary_ehp",
    "primary_ehb"
  ].map(normalizeName));

  for (const [key, value] of Object.entries(stats || {})) {
    const normalized = normalizeName(key);
    if (excluded.has(normalized) || seen.has(normalized)) continue;
    if (/(_rank|_level|_ehp|_ehb)$/.test(normalized)) continue;
    if (value && typeof value === "object") continue;

    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) continue;

    const canonical = canonicalBossName(key);
    if (knownBosses.includes(canonical)) {
      raw[labelize(canonical) + " Score"] = number;
    }
  }

  return raw;
}

function templeTotalLevel(stats) {
  const direct = templeValue(stats, ["Overall_level", "Overall level", "Total_level", "Total level"]);
  if (direct !== undefined) return toNumber(direct, 0);

  let total = 0;
  for (const skill of REAL_SKILLS) {
    const names = skill === "runecrafting"
      ? ["Runecrafting", "Runecraft"]
      : [skillLabel(skill)];

    const level = templeValue(stats, names.flatMap((name) => [name + "_level", name + " level"]));
    const xp = templeValue(stats, names);
    total += level !== undefined
      ? Math.max(0, toNumber(level, 0))
      : xpToLevel(xp);
  }
  return total;
}

function templeTotalXp(stats) {
  const direct = templeValue(stats, ["Overall", "Total_xp", "Total XP"]);
  if (direct !== undefined) return toNumber(direct, 0);

  let total = 0;
  for (const skill of REAL_SKILLS) {
    const names = skill === "runecrafting"
      ? ["Runecrafting", "Runecraft"]
      : [skillLabel(skill)];
    total += Math.max(0, toNumber(templeValue(stats, names), 0));
  }
  return total;
}

export function computeHiscoreResult(username, hiscore, classification) {
  const experienceMap = makeExperienceMap(hiscore);
  const killcountMap = makeKillcountMap(hiscore);

  const ehp = roundMetric(algorithms.main.calculateEHP(experienceMap));
  const ehb = roundMetric(algorithms.main.calculateEHB(killcountMap));

  const specialEhpProfile = selectSpecialProfile(classification);
  const specialEhpAlgorithm = specialEhpProfile ? algorithms[specialEhpProfile] : null;

  const specialEhbProfile = classification.build === "def1"
    ? "def1"
    : classification.mode === "ultimate"
      ? "ultimate"
      : ["ironman", "hardcore", "gim"].includes(classification.mode)
        ? "ironman"
        : null;
  const specialEhbAlgorithm = specialEhbProfile ? algorithms[specialEhbProfile] : null;

  const specialEhp = specialEhpAlgorithm
    ? roundMetric(specialEhpAlgorithm.calculateEHP(experienceMap))
    : 0;

  const specialEhb = specialEhbAlgorithm
    ? roundMetric(specialEhbAlgorithm.calculateEHB(killcountMap))
    : 0;

  const build = classification.build === "lvl3"
    ? "Level 3"
    : classification.build === "def1"
      ? "1 Defence"
      : "";

  const status = classification.warning || "Fetched from Jagex HiScores; efficiency calculated locally.";

  return {
    summary: {
      Username: username,
      Gamemode: classification.modeLabel,
      EHP: ehp,
      "Special EHP": specialEhp,
      EHB: ehb,
      "Special EHB": specialEhb,
      Build: build,
      Source: "Jagex HiScores",
      "Total Level": getHiscoreTotalLevel(hiscore),
      "Total XP": getHiscoreTotalXp(hiscore),
      Status: status
    },
    raw: buildHiscoreRaw(hiscore),
    statusLevel: classification.warning ? "warn" : "ok"
  };
}

export function computeTempleResult(requestedUsername, fallback) {
  const stats = fallback.stats || {};

  const ehp = metricFromTemple(stats, "Ehp");
  const imEhp = metricFromTemple(stats, "Im_ehp");
  const lvl3Ehp = metricFromTemple(stats, "Lvl3_ehp");
  const uimEhp = metricFromTemple(stats, "Uim_ehp");
  const oneDefEhp = metricFromTemple(stats, "1def_ehp");
  const gimEhp = metricFromTemple(stats, "Gim_ehp");

  const ehb = metricFromTemple(stats, "Ehb");
  const imEhb = metricFromTemple(stats, "Im_ehb");
  const uimEhb = metricFromTemple(stats, "Uim_ehb");
  const oneDefEhb = metricFromTemple(stats, "1def_ehb");

  const specialEhp = firstNonZero(lvl3Ehp, oneDefEhp, uimEhp, gimEhp, imEhp);
  const specialEhb = firstNonZero(oneDefEhb, uimEhb, imEhb);
  const build = lvl3Ehp !== 0 ? "Level 3" : oneDefEhp !== 0 ? "1 Defence" : "";

  const statusParts = [
    "Jagex HiScores lookup failed; using TempleOSRS.",
    fallback.refreshNote
  ].filter(Boolean);

  return {
    summary: {
      Username: fallback.username || requestedUsername,
      Gamemode: fallback.modeLabel || "Unknown",
      EHP: ehp,
      "Special EHP": specialEhp,
      EHB: ehb,
      "Special EHB": specialEhb,
      Build: build,
      Source: "TempleOSRS",
      "Total Level": templeTotalLevel(stats),
      "Total XP": templeTotalXp(stats),
      Status: statusParts.join(" ")
    },
    raw: buildTempleRaw(stats),
    statusLevel: fallback.refreshNote && /failed|older|unavailable/i.test(fallback.refreshNote)
      ? "warn"
      : "ok"
  };
}

export function makeErrorResult(username, error) {
  return {
    summary: {
      Username: username,
      Gamemode: "",
      EHP: "",
      "Special EHP": "",
      EHB: "",
      "Special EHB": "",
      Build: "",
      Source: "",
      "Total Level": "",
      "Total XP": "",
      Status: error instanceof Error ? error.message : String(error)
    },
    raw: {},
    statusLevel: "error"
  };
}

export function rawColumnOrder(results) {
  const skillColumns = [];
  for (const skill of REAL_SKILLS) {
    const label = skillLabel(skill);
    skillColumns.push(label + " Level", label + " XP");
  }

  const present = new Set(results.flatMap((result) => Object.keys(result.raw || {})));
  const orderedSkills = skillColumns.filter((column) => present.has(column));
  orderedSkills.forEach((column) => present.delete(column));

  return [...orderedSkills, ...Array.from(present).sort((a, b) => a.localeCompare(b))];
}
