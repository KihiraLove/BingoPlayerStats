import {
  canonicalBossName,
  deriveTempleGamemode,
  normalizeName,
  sleep,
  templeModeKey,
  toNumber
} from "./utils.js";

const WIKI_CORS_BASE = "https://oldschool.runescape.wiki/cors/";
const TEMPLE_BASE = "https://templeosrs.com";

export const HISCORE_ENDPOINTS = {
  normal: "m=hiscore_oldschool/index_lite.json",
  ironman: "m=hiscore_oldschool_ironman/index_lite.json",
  hardcore: "m=hiscore_oldschool_hardcore_ironman/index_lite.json",
  ultimate: "m=hiscore_oldschool_ultimate/index_lite.json",
  def1: "m=hiscore_oldschool_skiller_defence/index_lite.json",
  lvl3: "m=hiscore_oldschool_skiller/index_lite.json"
};

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function fetchWithRetry(url, options = {}) {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 12_000;

  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 404) {
        throw new HttpError("Not found", 404);
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new HttpError("HTTP " + response.status, response.status);
        const retryAfter = Number(response.headers.get("Retry-After"));
        await sleep(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 15_000) : 900 * (attempt + 1));
        continue;
      }

      throw new HttpError("HTTP " + response.status, response.status);
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = new Error("Request timed out");
      } else if (error instanceof HttpError && error.status === 404) {
        throw error;
      } else {
        lastError = error;
      }

      if (attempt < attempts - 1) {
        await sleep(500 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Request failed");
}

export async function fetchHiscore(username, endpointKey = "normal") {
  const endpoint = HISCORE_ENDPOINTS[endpointKey];
  if (!endpoint) throw new Error("Unknown HiScore endpoint: " + endpointKey);

  const player = encodeURIComponent(username.replace(/\s+/g, "_"));
  const response = await fetchWithRetry(WIKI_CORS_BASE + endpoint + "?player=" + player);
  const raw = await response.json();

  const skills = Array.isArray(raw?.skills) ? raw.skills : [];
  const activities = Array.isArray(raw?.activities) ? raw.activities : [];

  if (skills.length === 0) {
    throw new Error("HiScores returned no skill data");
  }

  const normalizedSkills = {};
  for (const skill of skills) {
    const key = normalizeName(skill.name === "Total" ? "overall" : skill.name);
    normalizedSkills[key] = {
      name: skill.name,
      rank: toNumber(skill.rank, -1),
      level: toNumber(skill.level, 0),
      xp: Math.max(0, toNumber(skill.xp, 0))
    };
  }

  const normalizedActivities = {};
  for (const activity of activities) {
    const key = canonicalBossName(activity.name);
    normalizedActivities[key] = {
      name: activity.name,
      rank: toNumber(activity.rank, -1),
      score: Math.max(0, toNumber(activity.score, 0))
    };
  }

  return {
    username,
    skills: normalizedSkills,
    activities: normalizedActivities
  };
}

async function isOnHiscore(username, endpointKey) {
  try {
    await fetchHiscore(username, endpointKey);
    return true;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return false;
    return false;
  }
}

function looksLevel3(skills) {
  const combatSkills = ["attack", "defence", "strength", "ranged", "prayer", "magic"];
  const basicCombat = combatSkills.every((skill) => toNumber(skills[skill]?.level, 1) <= 1);
  return basicCombat && toNumber(skills.hitpoints?.level, 10) <= 10;
}

export async function classifyFromHiscores(username, hiscore, resolveGim = true) {
  const classification = {
    mode: "main",
    modeLabel: "Main",
    build: "main",
    templeInfo: null,
    warning: ""
  };

  if (looksLevel3(hiscore.skills)) {
    classification.build = "lvl3";
  } else if (toNumber(hiscore.skills.defence?.level, 1) <= 1 && await isOnHiscore(username, "def1")) {
    classification.build = "def1";
  }

  if (await isOnHiscore(username, "ultimate")) {
    classification.mode = "ultimate";
    classification.modeLabel = "UIM";
  } else if (await isOnHiscore(username, "hardcore")) {
    classification.mode = "hardcore";
    classification.modeLabel = "HCIM";
  } else if (await isOnHiscore(username, "ironman")) {
    classification.mode = "ironman";
    classification.modeLabel = "IM";
  } else if (resolveGim) {
    try {
      const info = await fetchTempleInfo(username);
      classification.templeInfo = info;

      if (toNumber(info.gim, 0) !== 0) {
        classification.mode = "gim";
        classification.modeLabel = deriveTempleGamemode(info.gameMode, info.gim);
        classification.warning = "GIM special metrics use the local Ironman efficiency profile.";
      }
    } catch (_error) {
      classification.modeLabel = "Main / GIM";
      classification.warning = "TempleOSRS could not resolve whether this main-board account is GIM.";
    }
  }

  return classification;
}

function unwrapTempleInfo(raw) {
  if (raw && typeof raw === "object" && raw.data && typeof raw.data === "object") {
    return raw.data;
  }
  return raw && typeof raw === "object" ? raw : {};
}

export async function fetchTempleInfo(username) {
  const url =
    TEMPLE_BASE +
    "/api/player_info.php?player=" +
    encodeURIComponent(username) +
    "&dateformat=unix&formattedrsn=1";

  const response = await fetchWithRetry(url, { attempts: 2 });
  const raw = await response.json();
  const info = unwrapTempleInfo(raw);

  return {
    raw: info,
    username: info.player_name_with_capitalization || info.Username || username,
    gameMode: info["Game mode"] ?? info.Game_mode ?? null,
    gim: info.GIM ?? 0,
    lastChecked: toNumber(info["Last checked"] ?? info.last_checked, 0),
    datapointCooldown: toNumber(info["Datapoint Cooldown"] ?? info.datapoint_cooldown, 0)
  };
}

export async function triggerTempleUpdate(username) {
  const url = TEMPLE_BASE + "/php/add_datapoint.php?player=" + encodeURIComponent(username);
  const response = await fetchWithRetry(url, { attempts: 2, timeoutMs: 15_000 });
  return response.ok;
}

export async function fetchTempleStats(username) {
  const url =
    TEMPLE_BASE +
    "/api/player_stats.php?player=" +
    encodeURIComponent(username) +
    "&duration=alltime&bosses=1";

  const response = await fetchWithRetry(url, { attempts: 2, timeoutMs: 15_000 });
  const raw = await response.json();

  if (!raw || typeof raw !== "object" || !raw.data || typeof raw.data !== "object") {
    throw new Error("TempleOSRS returned no player data");
  }

  return raw.data;
}

export async function fetchTempleFallback(username) {
  let info = null;
  let refreshed = false;
  let refreshAttempted = false;
  let refreshNote = "";

  try {
    info = await fetchTempleInfo(username);
    const now = Math.floor(Date.now() / 1000);
    const stale = info.lastChecked > 0 && now - info.lastChecked >= 3600;

    if (stale && info.datapointCooldown <= 0) {
      refreshAttempted = true;
      try {
        refreshed = await triggerTempleUpdate(username);
        refreshNote = refreshed ? "Temple datapoint refresh requested." : "Temple refresh request did not succeed.";
        if (refreshed) await sleep(700);
      } catch (_error) {
        refreshNote = "Temple datapoint refresh failed; using the latest stored data.";
      }
    } else if (stale) {
      refreshNote = "Temple data is older than one hour but the datapoint cooldown is still active.";
    }
  } catch (_error) {
    refreshNote = "Temple player metadata was unavailable; using stored stats without a freshness check.";
  }

  const stats = await fetchTempleStats(username);

  if (!info && stats.info && typeof stats.info === "object") {
    const embedded = stats.info;
    info = {
      raw: embedded,
      username: embedded.player_name_with_capitalization || embedded.Username || username,
      gameMode: embedded["Game mode"] ?? embedded.Game_mode ?? null,
      gim: embedded.GIM ?? 0,
      lastChecked: toNumber(embedded["Last checked"] ?? embedded.last_checked, 0),
      datapointCooldown: toNumber(embedded["Datapoint Cooldown"] ?? embedded.datapoint_cooldown, 0)
    };
  }

  return {
    username: info?.username || username,
    stats,
    info,
    refreshed,
    refreshAttempted,
    refreshNote,
    modeKey: info ? templeModeKey(info.gameMode, info.gim) : "unknown",
    modeLabel: info ? deriveTempleGamemode(info.gameMode, info.gim) : "Unknown"
  };
}
