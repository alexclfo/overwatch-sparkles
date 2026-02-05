const express = require('express');
const { parseHeader, parsePlayerInfo, parseEvent, parseTicks } = require('@laihoe/demoparser2');
const { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const WORKER_SECRET = process.env.WORKER_SECRET;

// Increase payload limit for demo files
app.use(express.json({ limit: '500mb' }));

// Auth middleware
function authenticate(req, res, next) {
  if (WORKER_SECRET) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${WORKER_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}

// Helper to write demo buffer to temp file
function writeTempDemo(demoBuffer) {
  const buffer = Buffer.from(demoBuffer, 'base64');
  const tempDir = mkdtempSync(join(tmpdir(), 'demo-'));
  const tempFile = join(tempDir, 'demo.dem');
  writeFileSync(tempFile, buffer);
  return { tempDir, tempFile };
}

// Helper to clean up temp files
function cleanupTemp(tempDir, tempFile) {
  try {
    unlinkSync(tempFile);
    rmdirSync(tempDir);
  } catch {}
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Parse demo endpoint (basic info)
app.post('/parse', authenticate, async (req, res) => {
  let tempDir = null;
  let tempFile = null;
  
  try {
    const { demoBuffer } = req.body;
    if (!demoBuffer) {
      return res.status(400).json({ error: 'Missing demoBuffer' });
    }

    ({ tempDir, tempFile } = writeTempDemo(demoBuffer));

    const result = { map: null, players: [], serverName: null };

    try {
      const header = parseHeader(tempFile);
      result.map = header.map_name || null;
      result.serverName = header.server_name || null;
    } catch (err) {
      console.error('Header parse error:', err.message);
    }

    try {
      const playerInfo = parsePlayerInfo(tempFile);
      result.players = playerInfo
        .map(p => ({
          name: p.name || 'Unknown',
          steamId64: p.steamid || null,
          team: p.team_number === 2 ? 'T' : p.team_number === 3 ? 'CT' : null,
        }))
        .filter(p => p.steamId64);
    } catch (err) {
      console.error('Player parse error:', err.message);
    }

    cleanupTemp(tempDir, tempFile);
    res.json(result);
  } catch (error) {
    console.error('Parse error:', error);
    if (tempDir && tempFile) cleanupTemp(tempDir, tempFile);
    res.status(500).json({ error: error.message });
  }
});

// Parse demo stats endpoint (full match stats)
app.post('/stats', authenticate, async (req, res) => {
  let tempDir = null;
  let tempFile = null;
  
  try {
    const { demoBuffer } = req.body;
    if (!demoBuffer) {
      return res.status(400).json({ error: 'Missing demoBuffer' });
    }

    ({ tempDir, tempFile } = writeTempDemo(demoBuffer));

    const result = {
      map: null,
      players: [],
      serverName: null,
      scoreCT: 0,
      scoreT: 0,
      rounds: [],
      duration: null,
    };

    // Parse header
    try {
      const header = parseHeader(tempFile);
      result.map = header.map_name || null;
      result.serverName = header.server_name || null;
      result.duration = header.playback_time ? Math.round(header.playback_time) : null;
    } catch (err) {
      console.error('Header parse error:', err.message);
    }

    // Get all players
    const playerMap = new Map();
    try {
      const playerInfo = parsePlayerInfo(tempFile);
      playerInfo.forEach(p => {
        if (p.steamid) {
          playerMap.set(p.steamid, {
            name: p.name || 'Unknown',
            steamId64: p.steamid,
            team: p.team_number === 2 ? 'T' : p.team_number === 3 ? 'CT' : 'SPEC',
            kills: 0,
            deaths: 0,
            assists: 0,
            headshots: 0,
            damage: 0,
            roundsPlayed: 0,
          });
        }
      });
    } catch (err) {
      console.error('Player info parse error:', err.message);
    }

    // Parse kill events
    try {
      const kills = parseEvent(tempFile, 'player_death');
      kills.forEach(kill => {
        const attackerId = kill.attacker_steamid || kill.attacker_SteamID;
        const victimId = kill.user_steamid || kill.userid_steamid || kill.player_steamid;
        const assisterId = kill.assister_steamid;
        const isHeadshot = kill.headshot === true || kill.headshot === 1;
        
        if (attackerId && playerMap.has(attackerId)) {
          const attacker = playerMap.get(attackerId);
          attacker.kills++;
          if (isHeadshot) attacker.headshots++;
        }
        
        if (victimId && playerMap.has(victimId)) {
          playerMap.get(victimId).deaths++;
        }
        
        if (assisterId && playerMap.has(assisterId)) {
          playerMap.get(assisterId).assists++;
        }
      });
    } catch (e) {}

    // Parse round_end events
    try {
      const roundEnds = parseEvent(tempFile, 'round_end');
      if (roundEnds && roundEnds.length > 0) {
        let ctWins = 0;
        let tWins = 0;
        
        roundEnds.forEach((round, idx) => {
          const winnerTeam = round.winner;
          let winner = null;
          if (winnerTeam === 2) { winner = 'T'; tWins++; }
          else if (winnerTeam === 3) { winner = 'CT'; ctWins++; }
          
          let reason = 'elimination';
          const reasonCode = round.reason;
          if (reasonCode === 1) reason = 'bomb_exploded';
          else if (reasonCode === 7) reason = 'bomb_defused';
          else if (reasonCode === 12) reason = 'time';
          
          result.rounds.push({ roundNumber: idx + 1, winner, reason });
        });
        
        result.scoreCT = ctWins;
        result.scoreT = tWins;
      }
    } catch (e) {}

    // Fallback: try tick data for scores
    if (result.scoreCT === 0 && result.scoreT === 0) {
      try {
        const fields = ['team_rounds_total', 'team_num'];
        const tickData = parseTicks(tempFile, fields);
        if (tickData && tickData.length > 0) {
          let maxCT = 0, maxT = 0;
          tickData.forEach(row => {
            const score = row.team_rounds_total || 0;
            const team = row.team_num;
            if (team === 3 && score > maxCT) maxCT = score;
            if (team === 2 && score > maxT) maxT = score;
          });
          if (maxCT > 0 || maxT > 0) {
            result.scoreCT = maxCT;
            result.scoreT = maxT;
          }
        }
      } catch (e) {}
    }

    // Update rounds played
    const totalRounds = Math.max(result.rounds.length, 1);
    playerMap.forEach(p => { p.roundsPlayed = totalRounds; });

    // Convert to array with derived stats
    result.players = Array.from(playerMap.values()).map(p => ({
      ...p,
      adr: p.roundsPlayed > 0 ? Math.round((p.damage || 0) / p.roundsPlayed) : 0,
      hsPercent: p.kills > 0 ? Math.round((p.headshots / p.kills) * 100) : 0,
      kd: p.deaths > 0 ? +(p.kills / p.deaths).toFixed(2) : p.kills,
    }));

    result.players.sort((a, b) => b.kills - a.kills);

    cleanupTemp(tempDir, tempFile);
    res.json(result);
  } catch (error) {
    console.error('Stats parse error:', error);
    if (tempDir && tempFile) cleanupTemp(tempDir, tempFile);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});
