import { REAL_SKILLS } from "./vendor/wom/types.js";
import { canonicalBossName, normalizeName } from "./utils.js";

const SKILL_LABELS = new Map([
  ["runecrafting", "Runecrafting"],
  ["hitpoints", "Hitpoints"]
]);

export function labelize(value) {
  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function skillLabel(skill) {
  return SKILL_LABELS.get(skill) || labelize(skill);
}

export const HISCORE_ACTIVITIES = [
  "Bounty Hunter - Hunter",
  "Bounty Hunter - Rogue",
  "Clue Scrolls (all)",
  "Clue Scrolls (beginner)",
  "Clue Scrolls (easy)",
  "Clue Scrolls (medium)",
  "Clue Scrolls (hard)",
  "Clue Scrolls (elite)",
  "Clue Scrolls (master)",
  "LMS - Rank",
  "PvP Arena - Rank",
  "Soul Wars Zeal",
  "Rifts closed",
  "Colosseum Glory",
  "Collections Logged"
];

export const HISCORE_BOSSES = [
  "Abyssal Sire",
  "Alchemical Hydra",
  "Amoxliatl",
  "Araxxor",
  "Artio",
  "Barrows Chests",
  "Brutus",
  "Bryophyta",
  "Callisto",
  "Calvar'ion",
  "Cerberus",
  "Chambers of Xeric",
  "Chambers of Xeric: Challenge Mode",
  "Chaos Elemental",
  "Chaos Fanatic",
  "Commander Zilyana",
  "Corporeal Beast",
  "Crazy Archaeologist",
  "Dagannoth Prime",
  "Dagannoth Rex",
  "Dagannoth Supreme",
  "Deranged Archaeologist",
  "Doom of Mokhaiotl",
  "Duke Sucellus",
  "General Graardor",
  "Giant Mole",
  "Grotesque Guardians",
  "Hespori",
  "Kalphite Queen",
  "King Black Dragon",
  "Kraken",
  "Kree'Arra",
  "K'ril Tsutsaroth",
  "Lunar Chests",
  "Mad Angel",
  "Maggot King",
  "Mimic",
  "Nex",
  "Nightmare",
  "Phosani's Nightmare",
  "Obor",
  "Phantom Muspah",
  "Sarachnis",
  "Scorpia",
  "Scurrius",
  "Shellbane Gryphon",
  "Skotizo",
  "Sol Heredit",
  "Spindel",
  "Tempoross",
  "The Gauntlet",
  "The Corrupted Gauntlet",
  "The Hueycoatl",
  "The Leviathan",
  "The Royal Titans",
  "The Whisperer",
  "Theatre of Blood",
  "Theatre of Blood: Hard Mode",
  "Thermonuclear Smoke Devil",
  "Tombs of Amascut",
  "Tombs of Amascut: Expert Mode",
  "TzKal-Zuk",
  "TzTok-Jad",
  "Vardorvis",
  "Venenatis",
  "Vet'ion",
  "Vorkath",
  "Wintertodt",
  "Yama",
  "Zalcano",
  "Zulrah"
];

const OMITTED_ACTIVITY_KEYS = new Set([
  "league_points",
  "grid_points"
]);

const NO_SUFFIX_KEYS = new Set([
  "bounty_hunter_hunter",
  "bounty_hunter_rogue",
  "lms_rank",
  "pvp_arena_rank",
  "rifts_closed",
  "colosseum_glory",
  "collections_logged",
  "soul_wars_zeal",
  "lunar_chests",
  "barrows_chests"
]);

export function isOmittedActivity(name) {
  return OMITTED_ACTIVITY_KEYS.has(normalizeName(name));
}

export function activityColumnName(name) {
  if (isOmittedActivity(name)) return null;

  const normalized = normalizeName(name);
  if (normalized.startsWith("clue_scrolls_") || NO_SUFFIX_KEYS.has(normalized)) {
    return String(name);
  }

  return String(name) + " KC";
}

const BOSS_COLUMN_BY_CANONICAL = new Map(
  HISCORE_BOSSES.map((name) => [canonicalBossName(name), activityColumnName(name)])
);

export function bossColumnName(canonicalName) {
  return BOSS_COLUMN_BY_CANONICAL.get(canonicalName) || labelize(canonicalName) + " KC";
}

const SKILL_LEVEL_COLUMNS = REAL_SKILLS.map((skill) => skillLabel(skill) + " Level");
const SKILL_XP_COLUMNS = REAL_SKILLS.map((skill) => skillLabel(skill) + " XP");
const BOSS_COLUMNS = HISCORE_BOSSES.map(activityColumnName).filter(Boolean);
const ACTIVITY_COLUMNS = HISCORE_ACTIVITIES.map(activityColumnName).filter(Boolean);

export const SKILL_STAT_ROWS = REAL_SKILLS.map((skill) => ({
  label: skillLabel(skill),
  levelColumn: skillLabel(skill) + " Level",
  xpColumn: skillLabel(skill) + " XP"
}));

export const STAT_GROUPS = [
  { id: "bosses", label: "Bosses", columns: BOSS_COLUMNS },
  { id: "activities", label: "Activities", columns: ACTIVITY_COLUMNS }
];

export const LINK_OPTIONS = [
  { column: "HiScores", label: "HiScores page" },
  { column: "TempleOSRS", label: "TempleOSRS page" },
  { column: "WOM", label: "WOM page" }
];

export const SELECTABLE_LINK_COLUMNS = LINK_OPTIONS.map((option) => option.column);

export const SELECTABLE_STAT_COLUMNS = [
  ...SKILL_LEVEL_COLUMNS,
  ...SKILL_XP_COLUMNS,
  ...BOSS_COLUMNS,
  ...ACTIVITY_COLUMNS
];
