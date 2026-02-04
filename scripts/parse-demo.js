#!/usr/bin/env node
// Standalone demo parser script - called via child_process to avoid bundler issues
const { parseHeader, parsePlayerInfo } = require('@laihoe/demoparser2');

const filePath = process.argv[2];
if (!filePath) {
  console.error(JSON.stringify({ error: "No file path provided" }));
  process.exit(1);
}

try {
  const result = {
    map: null,
    players: [],
    serverName: null,
  };

  // Parse header
  const header = parseHeader(filePath);
  result.map = header.map_name || null;
  result.serverName = header.server_name || null;

  // Get all players using parsePlayerInfo (more reliable than events)
  try {
    const playerInfo = parsePlayerInfo(filePath);
    result.players = playerInfo.map(p => ({
      name: p.name || "Unknown",
      steamId64: p.steamid || null,
      team: p.team_number === 2 ? "T" : p.team_number === 3 ? "CT" : null,
    })).filter(p => p.steamId64); // Filter out bots/invalid
  } catch (e) {
    console.error("parsePlayerInfo failed:", e.message);
  }

  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
