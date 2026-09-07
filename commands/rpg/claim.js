// claim.js — Claim a spawned artifact
const ArtifactSpawn = require('./artifactspawn');

module.exports = {
  name: 'claim',
  description: 'Claim a spawned group artifact',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    return ArtifactSpawn.handleClaim(sock, msg, args, getDatabase, saveDatabase, sender);
  }
};