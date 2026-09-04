import EfficiencyAlgorithm from "./EfficiencyAlgorithm.js";
import mainEhp from "./configs/ehp/main.js";
import ironmanEhp from "./configs/ehp/ironman.js";
import ultimateEhp from "./configs/ehp/ultimate.js";
import lvl3Ehp from "./configs/ehp/lvl3.js";
import def1Ehp from "./configs/ehp/def1.js";
import mainEhb from "./configs/ehb/main.js";
import ironmanEhb from "./configs/ehb/ironman.js";
import ultimateEhb from "./configs/ehb/ultimate.js";
import def1Ehb from "./configs/ehb/def1.js";

export const algorithms = {
  main: new EfficiencyAlgorithm("main", mainEhp, mainEhb),
  ironman: new EfficiencyAlgorithm("ironman", ironmanEhp, ironmanEhb),
  ultimate: new EfficiencyAlgorithm("ultimate", ultimateEhp, ultimateEhb),
  lvl3: new EfficiencyAlgorithm("lvl3", lvl3Ehp, []),
  def1: new EfficiencyAlgorithm("def1", def1Ehp, def1Ehb)
};

export const knownBosses = Array.from(
  new Set(
    Object.values(algorithms)
      .flatMap((algorithm) => algorithm.bossMetas)
      .map((meta) => meta.boss)
  )
).sort();
