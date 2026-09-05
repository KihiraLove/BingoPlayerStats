import test from "node:test";
import assert from "node:assert/strict";

import { algorithms } from "../src/vendor/wom/index.js";
import { hasProgressedBeyondSnapshot } from "../src/data.js";
import {
  activityColumnName,
  isOmittedActivity
} from "../src/stat-catalog.js";
import {
  deriveTempleGamemode,
  parseUsernames,
  selectSpecialProfile,
  xpToLevel
} from "../src/utils.js";
import {
  buildPlayerLinks,
  computeTempleResult,
  outputValue
} from "../src/metrics.js";

test("parseUsernames accepts spreadsheet-style input and deduplicates names", () => {
  assert.deepEqual(
    parseUsernames("Zezima\nLynx Titan\tzezima\n  Iron Player  "),
    ["Zezima", "Lynx Titan", "Iron Player"]
  );
});

test("Temple GIM codes are rendered like the original CLI", () => {
  assert.equal(deriveTempleGamemode(0, 14), "Regular GIM 4-player");
  assert.equal(deriveTempleGamemode(0, 23), "Hardcore GIM 3-player");
  assert.equal(deriveTempleGamemode(2, 0), "UIM");
});

test("unknown Temple gamemode defaults to Main", () => {
  assert.equal(deriveTempleGamemode(null, 0), "Main");
  assert.equal(deriveTempleGamemode(99, 0), "Main");
});

test("special profile selection preserves build priority", () => {
  assert.equal(selectSpecialProfile({ build: "lvl3", mode: "ironman" }), "lvl3");
  assert.equal(selectSpecialProfile({ build: "def1", mode: "ultimate" }), "def1");
  assert.equal(selectSpecialProfile({ build: "main", mode: "ultimate" }), "ultimate");
  assert.equal(selectSpecialProfile({ build: "main", mode: "gim" }), "ironman");
  assert.equal(selectSpecialProfile({ build: "main", mode: "main" }), null);
});

test("vendored EHB algorithm uses the current main Zulrah rate", () => {
  const ehb = algorithms.main.calculateEHB(new Map([["zulrah", 46]]));
  assert.equal(ehb, 1);
});

test("zero experience produces zero local EHP", () => {
  assert.equal(algorithms.main.calculateEHP(new Map()), 0);
});

test("Temple result keeps original special EHP and EHB precedence internally", () => {
  const result = computeTempleResult("Example", {
    username: "Example",
    modeLabel: "IM",
    stats: {
      Ehp: 100,
      Im_ehp: 75,
      Lvl3_ehp: 0,
      Uim_ehp: 0,
      "1def_ehp": 81,
      Gim_ehp: 90,
      Ehb: 50,
      Im_ehb: 40,
      Uim_ehb: 45,
      "1def_ehb": 48
    },
    refreshNote: ""
  });

  assert.equal(result.special.EHP, 81);
  assert.equal(result.special.EHB, 48);
  assert.equal(result.summary.EHP, 100);
  assert.equal(result.summary.EHB, 50);
  assert.equal("Special EHP" in result.summary, false);
  assert.equal("Special EHB" in result.summary, false);
  assert.equal("Build" in result.summary, false);
  assert.equal("Source" in result.summary, false);
  assert.equal("Status" in result.summary, false);
});

test("special metrics replace EHP/EHB only when requested and available", () => {
  const result = {
    summary: { EHP: 100, EHB: 50 },
    special: { EHP: 81, EHB: 0 },
    raw: {}
  };

  assert.equal(outputValue(result, "EHP", false), 100);
  assert.equal(outputValue(result, "EHP", true), 81);
  assert.equal(outputValue(result, "EHB", true), 50);
});

test("activity headings use requested score/KC semantics", () => {
  assert.equal(activityColumnName("Clue Scrolls (elite)"), "Clue Scrolls (elite)");
  assert.equal(activityColumnName("Collections Logged"), "Collections Logged");
  assert.equal(activityColumnName("Colosseum Glory"), "Colosseum Glory");
  assert.equal(activityColumnName("Bounty Hunter - Hunter"), "Bounty Hunter - Hunter");
  assert.equal(activityColumnName("PvP Arena - Rank"), "PvP Arena - Rank");
  assert.equal(activityColumnName("Rifts closed"), "Rifts closed");
  assert.equal(activityColumnName("LMS - Rank"), "LMS - Rank");
  assert.equal(activityColumnName("Lunar Chests"), "Lunar Chests");
  assert.equal(activityColumnName("Barrows Chests"), "Barrows Chests");
  assert.equal(activityColumnName("Zulrah"), "Zulrah KC");
  assert.equal(activityColumnName("Soul Wars Zeal"), "Soul Wars Zeal");
});

test("league and grid points are omitted", () => {
  assert.equal(isOmittedActivity("League Points"), true);
  assert.equal(isOmittedActivity("Grid Points"), true);
  assert.equal(activityColumnName("League Points"), null);
  assert.equal(activityColumnName("Grid Points"), null);
});

test("XP converts to standard OSRS skill levels", () => {
  assert.equal(xpToLevel(0), 1);
  assert.equal(xpToLevel(83), 2);
  assert.equal(xpToLevel(13_034_431), 99);
  assert.equal(xpToLevel(200_000_000), 99);
});


test("HCIM snapshot comparison detects post-death progression", () => {
  const frozen = {
    skills: {
      overall: { xp: 10_000 },
      attack: { xp: 1_000 }
    },
    activities: {
      zulrah: { score: 5 }
    }
  };

  assert.equal(
    hasProgressedBeyondSnapshot(
      {
        skills: {
          overall: { xp: 10_000 },
          attack: { xp: 1_000 }
        },
        activities: {
          zulrah: { score: 5 }
        }
      },
      frozen
    ),
    false
  );

  assert.equal(
    hasProgressedBeyondSnapshot(
      {
        skills: {
          overall: { xp: 10_001 },
          attack: { xp: 1_001 }
        },
        activities: {
          zulrah: { score: 5 }
        }
      },
      frozen
    ),
    true
  );

  assert.equal(
    hasProgressedBeyondSnapshot(
      {
        skills: {
          overall: { xp: 10_000 },
          attack: { xp: 1_000 }
        },
        activities: {
          zulrah: { score: 6 }
        }
      },
      frozen
    ),
    true
  );

  assert.equal(
    hasProgressedBeyondSnapshot(
      {
        skills: {
          overall: { xp: 10_000 },
          attack: { xp: 1_000 },
          sailing: { xp: 500 }
        },
        activities: {
          zulrah: { score: 5 }
        }
      },
      frozen
    ),
    true
  );
});

test("player profile links use the requested username", () => {
  const links = buildPlayerLinks("Iron Player");
  assert.equal(
    links["HiScores Link"],
    "https://secure.runescape.com/m=hiscore_oldschool/hiscorepersonal?user1=Iron%20Player"
  );
  assert.equal(
    links["TempleOSRS Link"],
    "https://templeosrs.com/player/overview.php?duration=365days&player=Iron%20Player"
  );
  assert.equal(
    links["WOM Link"],
    "https://wiseoldman.net/players/Iron%20Player"
  );
});
