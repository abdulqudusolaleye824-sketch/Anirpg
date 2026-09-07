// Skill slot management (Max 5 skills)
const MAX_SKILL_SLOTS = 5;

function canLearnSkill(player) {
  return player.skills.active.length < MAX_SKILL_SLOTS;
}

function getSkillSlotInfo(player) {
  return {
    current: player.skills.active.length,
    max: MAX_SKILL_SLOTS,
    available: MAX_SKILL_SLOTS - player.skills.active.length
  };
}

function forgetSkill(player, skillIndex) {
  if (skillIndex < 0 || skillIndex >= player.skills.active.length) {
    throw new Error('Invalid skill index');
  }
  
  const forgottenSkill = player.skills.active[skillIndex];
  player.skills.active.splice(skillIndex, 1);
  
  return forgottenSkill;
}

function learnSkill(player, skill) {
  if (!canLearnSkill(player)) {
    throw new Error('Skill slots full! Use /skills forget [#] to make space');
  }
  
  // Check if already knows this skill
  if (player.skills.active.find(s => s.name === skill.name)) {
    throw new Error('You already know this skill!');
  }
  
  player.skills.active.push(skill);
  return true;
}

function replaceSkill(player, oldSkillIndex, newSkill) {
  if (oldSkillIndex < 0 || oldSkillIndex >= player.skills.active.length) {
    throw new Error('Invalid skill index');
  }
  
  const oldSkill = player.skills.active[oldSkillIndex];
  player.skills.active[oldSkillIndex] = newSkill;
  
  return { oldSkill, newSkill };
}

module.exports = {
  MAX_SKILL_SLOTS,
  canLearnSkill,
  getSkillSlotInfo,
  forgetSkill,
  learnSkill,
  replaceSkill
};