// Test script to understand demofile library output structure
const { DemoFile } = require("demofile");
const fs = require("fs");
const path = require("path");

// You can test with a demo file path as argument
const demoPath = process.argv[2];

if (!demoPath) {
  console.log("Usage: node test-demofile.js <path-to-demo.dem>");
  console.log("\nThis script will parse a CS2/CSGO demo and show the structure.");
  process.exit(1);
}

if (!fs.existsSync(demoPath)) {
  console.error("Demo file not found:", demoPath);
  process.exit(1);
}

console.log("Parsing demo:", demoPath);
console.log("=".repeat(60));

const demoFile = new DemoFile();

// Track data we want to extract
const players = [];
let mapName = null;
let serverName = null;

// Listen for game events
demoFile.on("start", () => {
  console.log("\n[EVENT] Demo started");
  console.log("Header:", JSON.stringify(demoFile.header, null, 2));
  
  mapName = demoFile.header.mapName;
  serverName = demoFile.header.serverName;
});

// When string tables are ready (contains player info)
demoFile.stringTables.on("update", (e) => {
  if (e.table.name === "userinfo" && e.userData) {
    console.log("\n[USERINFO]", e.userData);
  }
});

// Track player info when entities are created
demoFile.entities.on("create", (e) => {
  if (e.entity.serverClass?.name === "CCSPlayerController") {
    // This is a player controller
  }
});

// When game starts, get all players
demoFile.gameEvents.on("round_start", () => {
  console.log("\n[ROUND START] Getting player info...");
  
  for (const player of demoFile.players) {
    if (player.isFakePlayer) continue;
    
    const info = {
      name: player.name,
      odx: player.odx,
      odxId64: player.odx64?.toString(),
      odxId: player.odxId,
      steam64: player.steam64Id,
      odxId2: player.odxId2,
      odxId3: player.odxId3,
      team: player.teamNumber,
      teamName: player.team?.teamName,
    };
    
    console.log("Player:", info);
    
    // Try to find the steam64 ID
    if (player.steam64Id || player.odx64) {
      players.push({
        name: player.name,
        steamId64: player.steam64Id || player.odx64?.toString(),
        team: player.teamNumber === 2 ? "T" : player.teamNumber === 3 ? "CT" : "SPEC",
      });
    }
  }
});

demoFile.on("end", (e) => {
  console.log("\n" + "=".repeat(60));
  console.log("[DEMO END]");
  console.log("Map:", mapName);
  console.log("Server:", serverName);
  console.log("\nExtracted Players:");
  
  // Dedupe players
  const uniquePlayers = [];
  const seen = new Set();
  for (const p of players) {
    const key = p.steamId64 || p.name;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePlayers.push(p);
    }
  }
  
  console.log(JSON.stringify(uniquePlayers, null, 2));
  
  console.log("\n[STRUCTURE] DemoFile object keys:");
  console.log(Object.keys(demoFile));
  
  console.log("\n[STRUCTURE] Header object:");
  console.log(demoFile.header);
  
  if (demoFile.players.length > 0) {
    console.log("\n[STRUCTURE] First player object keys:");
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(demoFile.players[0])));
    console.log("\n[STRUCTURE] First player data:");
    const p = demoFile.players[0];
    console.log({
      name: p.name,
      odx64: p.odx64,
      odxId: p.odxId,
      odxId2: p.odxId2,
      odxId3: p.odxId3,
      odxId_SteamID64: p.odxId?.getSteamID64?.(),
      steam64Id: p.steam64Id,
      teamNumber: p.teamNumber,
      isFakePlayer: p.isFakePlayer,
    });
  }
});

// Parse the demo
const buffer = fs.readFileSync(demoPath);
demoFile.parse(buffer);
