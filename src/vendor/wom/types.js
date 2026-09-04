export const Skill = new Proxy({}, {
  get: (_target, property) => String(property).toLowerCase()
});

export const Boss = new Proxy({}, {
  get: (_target, property) => String(property).toLowerCase()
});

export const REAL_SKILLS = [
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecrafting",
  "hunter",
  "construction",
  "sailing"
];

export const ALL_SKILLS = ["overall", ...REAL_SKILLS];
