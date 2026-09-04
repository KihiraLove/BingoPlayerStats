import test from "node:test";
import assert from "node:assert/strict";

import { algorithms } from "../src/vendor/wom/index.js";
import {
  deriveTempleGamemode,
  parseUsernames,
  selectSpecialProfile,
  xpToLevel
} from "../src/utils.js";
import { computeTempleResult } from "../src/metrics.js";

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

test("Temple result keeps original special EHP and EHB precedence", () => {
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

  assert.equal(result.summary["Special EHP"], 81);
  assert.equal(result.summary["Special EHB"], 48);
  assert.equal(result.summary.EHP, 100);
  assert.equal(result.summary.EHB, 50);
});

test("XP converts to standard OSRS skill levels", () => {
  assert.equal(xpToLevel(0), 1);
  assert.equal(xpToLevel(83), 2);
  assert.equal(xpToLevel(13_034_431), 99);
  assert.equal(xpToLevel(200_000_000), 99);
});
