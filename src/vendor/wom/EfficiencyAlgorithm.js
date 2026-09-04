import { REAL_SKILLS } from "./types.js";

const MAX_SKILL_EXP = 200_000_000;
const BONUS_START = 0;
const BONUS_END = 1;

function roundNumber(value, decimals = 5) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export default class EfficiencyAlgorithm {
  constructor(type, skillMetas, bossMetas = []) {
    this.type = type;
    this.skillMetas = skillMetas;
    this.bossMetas = bossMetas;
    this.startBonuses = this.getBonuses(skillMetas, BONUS_START);
    this.endBonuses = this.getBonuses(skillMetas, BONUS_END);
    this.bonusDirectionMap = this.getBonusDirectionMap([...this.startBonuses, ...this.endBonuses]);
    this.maximumEHPMap = this.calculateMaximumEHPMap();
  }

  calculateEHB(killcountMap) {
    return Array.from(this.calculateEHBMap(killcountMap).values()).reduce((a, c) => a + c, 0);
  }

  calculateEHP(stats) {
    return this.calculateEHPMap(stats).get("overall") || 0;
  }

  calculateEHPMap(stats) {
    const fixedStats = new Map();
    REAL_SKILLS.forEach((skill) => {
      fixedStats.set(skill, Math.max(0, Number(stats.get(skill) || 0)));
    });

    const map = new Map(REAL_SKILLS.map((skill) => [skill, 0]));
    const startBonusExp = this.calculateBonusExp(fixedStats, BONUS_START);
    const endBonusExp = this.calculateBonusExp(fixedStats, BONUS_END);

    REAL_SKILLS.forEach((originSkill) => {
      let timeSum = 0;
      const bonusSkills = new Set(this.bonusDirectionMap.get(originSkill) || []);

      bonusSkills.forEach((bonusSkill) => {
        const dependants = this.bonusDirectionMap.get(bonusSkill) || [];
        dependants.forEach((dependant) => bonusSkills.add(dependant));
      });

      [...bonusSkills, originSkill].forEach((bonusSkill) => {
        const startExp = fixedStats.get(bonusSkill) + (startBonusExp.get(bonusSkill) || 0);
        const endExp = MAX_SKILL_EXP - (endBonusExp.get(bonusSkill) || 0);

        if (endExp - startExp <= 0 && bonusSkill !== originSkill) {
          return;
        }

        const resetStats = new Map(fixedStats);
        resetStats.set(originSkill, 0);

        const startBonusesReset = this.calculateBonusExp(resetStats, BONUS_START);
        const endBonusesReset = this.calculateBonusExp(resetStats, BONUS_END);

        const startExpReset = resetStats.get(bonusSkill) + (startBonusesReset.get(bonusSkill) || 0);
        const endExpReset = MAX_SKILL_EXP - (endBonusesReset.get(bonusSkill) || 0);

        const diff =
          this.calculateSkillTime(bonusSkill, startExpReset, endExpReset) -
          this.calculateSkillTime(bonusSkill, startExp, endExp);

        if (endExp - startExp <= 0) {
          timeSum += Math.min(this.maximumEHPMap.get(bonusSkill) || 0, diff);
        } else {
          timeSum += diff;
        }
      });

      map.set(originSkill, roundNumber(timeSum, 5));
    });

    const totalEHP = Array.from(map.values()).reduce((a, b) => a + b, 0);
    map.set("overall", totalEHP);
    return map;
  }

  calculateEHBMap(killcountMap) {
    const map = new Map();

    this.bossMetas.forEach((meta) => {
      if (!meta || Number(meta.rate) <= 0) return;
      const kc = Math.max(0, Number(killcountMap.get(meta.boss) || 0));
      map.set(meta.boss, roundNumber(kc / Number(meta.rate), 5));
    });

    return map;
  }

  calculateBonusExp(stats, type) {
    const isStart = type === BONUS_START;
    const bonuses = [...(isStart ? this.startBonuses : this.endBonuses)];
    const map = new Map(REAL_SKILLS.map((skill) => [skill, 0]));

    bonuses
      .sort((a, b) =>
        (this.bonusDirectionMap.get(b.bonusSkill)?.length || 0) -
        (this.bonusDirectionMap.get(a.bonusSkill)?.length || 0)
      )
      .forEach((bonus) => {
        if (!isStart && bonus.originSkill === "hunter" && bonus.bonusSkill === "fishing") {
          const scaled = this.getDriftNetScaledBonus(stats);
          if (scaled) {
            map.set("fishing", (map.get("fishing") || 0) + scaled);
            return;
          }
        }

        if (!isStart && bonus.originSkill === "thieving" && bonus.bonusSkill === "agility") {
          const scaled = this.getSwimmingScaledBonus(stats);
          if (scaled) {
            map.set("agility", (map.get("agility") || 0) + scaled);
            return;
          }
        }

        if (!isStart && bonus.originSkill === "firemaking" && bonus.bonusSkill === "thieving") {
          const scaled = this.getFirefactScaledBonus(stats);
          if (scaled) {
            map.set("thieving", (map.get("thieving") || 0) + scaled);
            return;
          }
        }

        const expCap = Math.min(Number(bonus.endExp), MAX_SKILL_EXP);
        const originStart =
          Math.max(Number(stats.get(bonus.originSkill) || 0), Number(bonus.startExp || 0)) +
          (isStart ? Number(map.get(bonus.originSkill) || 0) : 0);
        const originEnd = !isStart
          ? expCap - Number(map.get(bonus.originSkill) || 0)
          : expCap;

        const bonusToApply = Math.max(0, originEnd - originStart) * Number(bonus.ratio || 0);
        map.set(
          bonus.bonusSkill,
          Math.min(MAX_SKILL_EXP, Number(map.get(bonus.bonusSkill) || 0) + bonusToApply)
        );
      });

    return map;
  }

  getDriftNetScaledBonus(stats) {
    return this.getScaledMaxBonus(
      stats,
      "hunter",
      "fishing",
      this.skillMetas.find((meta) => meta.skill === "hunter")?.methods.find((method) => Boolean(method.realRate)),
      this.skillMetas.find((meta) => meta.skill === "fishing")?.methods.at(-1),
      this.skillMetas.find((meta) => meta.skill === "hunter")?.bonuses[0]?.ratio
    );
  }

  getSwimmingScaledBonus(stats) {
    return this.getScaledMaxBonus(
      stats,
      "thieving",
      "agility",
      this.skillMetas.find((meta) => meta.skill === "thieving")?.methods.find((method) => Boolean(method.realRate)),
      this.skillMetas.find((meta) => meta.skill === "agility")?.methods.at(-1),
      this.skillMetas.find((meta) => meta.skill === "thieving")?.bonuses[0]?.ratio
    );
  }

  getFirefactScaledBonus(stats) {
    return this.getScaledMaxBonus(
      stats,
      "firemaking",
      "thieving",
      this.skillMetas.find((meta) => meta.skill === "firemaking")?.methods.find((method) => Boolean(method.realRate)),
      this.skillMetas.find((meta) => meta.skill === "thieving")?.methods.at(-1),
      this.skillMetas.find((meta) => meta.skill === "firemaking")?.bonuses[0]?.ratio
    );
  }

  getScaledMaxBonus(stats, originSkill, bonusSkill, originMethod, bonusMethod, bonusRatio) {
    if (!originMethod || !bonusMethod || !bonusRatio) return 0;

    const originSkillStart = Math.max(Number(originMethod.startExp), Number(stats.get(originSkill) || 0));
    const originExpLeft = MAX_SKILL_EXP - originSkillStart;

    const realTime =
      this.calculateSkillTime(originSkill, originSkillStart, MAX_SKILL_EXP, true) +
      this.calculateSkillTime(bonusSkill, Number(stats.get(bonusSkill) || 0), MAX_SKILL_EXP, true);

    const fakeTime =
      this.calculateSkillTime(originSkill, originSkillStart, MAX_SKILL_EXP, false) +
      this.calculateSkillTime(bonusSkill, Number(stats.get(bonusSkill) || 0), MAX_SKILL_EXP, false);

    const excessBonuses = (realTime - fakeTime) * Number(bonusMethod.rate);
    const fakeBonusLeft = originExpLeft * Number(bonusRatio);
    return fakeBonusLeft - excessBonuses;
  }

  calculateSkillTime(skill, startExp, endExp, useRealRates = false) {
    const methods = this.skillMetas.find((meta) => meta.skill === skill)?.methods;

    if (!methods || (methods.length === 1 && Number(methods[0].rate) === 0)) {
      return (endExp - startExp) / MAX_SKILL_EXP;
    }

    let skillTime = 0;

    for (let i = 0; i < methods.length; i += 1) {
      const current = methods[i];
      const next = methods[i + 1];

      if (Number(current.rate) === 0) continue;

      const rate = useRealRates && current.realRate ? Number(current.realRate) : Number(current.rate);

      if (next && Number(next.startExp) > startExp && Number(current.startExp) < endExp) {
        const gained =
          Math.min(Number(next.startExp), endExp) -
          Math.max(startExp, Number(current.startExp));
        skillTime += gained / rate;
      }

      if (!next && endExp > Number(current.startExp)) {
        const gained = endExp - Math.max(Number(current.startExp), startExp);
        skillTime += gained / rate;
      }
    }

    return skillTime;
  }

  calculateMaximumEHPMap() {
    const map = new Map(REAL_SKILLS.map((skill) => [skill, 0]));
    const zeroStats = new Map(REAL_SKILLS.map((skill) => [skill, 0]));
    const startBonusExp = this.calculateBonusExp(zeroStats, BONUS_START);
    const endBonusExp = this.calculateBonusExp(zeroStats, BONUS_END);

    REAL_SKILLS.forEach((skill) => {
      const startExp = Number(startBonusExp.get(skill) || 0);
      const endExp = MAX_SKILL_EXP - Number(endBonusExp.get(skill) || 0);
      map.set(skill, this.calculateSkillTime(skill, startExp, endExp));
    });

    map.set("overall", Array.from(map.values()).reduce((a, b) => a + b, 0));
    return map;
  }

  getBonusDirectionMap(bonuses) {
    const map = new Map();

    bonuses.forEach((bonus) => {
      const current = map.get(bonus.originSkill) || [];
      if (!current.includes(bonus.bonusSkill)) {
        map.set(bonus.originSkill, [...current, bonus.bonusSkill]);
      }
    });

    return map;
  }

  getBonuses(metas, type) {
    return metas
      .filter((meta) => Array.isArray(meta.bonuses) && meta.bonuses.length > 0)
      .flatMap((meta) => meta.bonuses)
      .filter((bonus) => Boolean(bonus?.end) === (type === BONUS_END));
  }
}
