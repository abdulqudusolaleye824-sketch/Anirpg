const Perms = require('./utils/permissions');
const { COOWNER_JID, OWNER_JID } = require('./utils/constants');

console.log('--- TEST MAINTENANCE MODE BYPASS & PERMISSIONS ---');
const db = { botOwners: [], botMods: [], system: { maintenance: true } };

const isOwnerMod = Perms.isBotOwner(db, COOWNER_JID) || Perms.isBotMod(db, COOWNER_JID);
console.log('Is Co-Owner recognized as Owner/Mod?', isOwnerMod);

if (!isOwnerMod) throw new Error('Co-Owner is NOT recognized as Owner/Mod!');

console.log('--- TEST PASSED SUCCESSFULLY! ---');
