#!/usr/bin/env node
// Extended demo parser script - extracts full match stats
const { parseHeader, parsePlayerInfo, parseEvent, parseTicks } = require('@laihoe/demoparser2');

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
    scoreCT: 0,
    scoreT: 0,
    rounds: [],
    duration: null,
  };

  // Parse header
  const header = parseHeader(filePath);
  result.map = header.map_name || null;
  result.serverName = header.server_name || null;
  result.duration = header.playback_time ? Math.round(header.playback_time) : null;

  // Get all players using parsePlayerInfo
  const playerInfo = parsePlayerInfo(filePath);
  const playerMap = new Map();
  
  playerInfo.forEach(p => {
    if (p.steamid) {
      playerMap.set(p.steamid, {
        name: p.name || "Unknown",
        steamId64: p.steamid,
        team: p.team_number === 2 ? "T" : p.team_number === 3 ? "CT" : "SPEC",
        kills: 0,
        deaths: 0,
        assists: 0,
        headshots: 0,
        damage: 0,
        roundsPlayed: 0,
      });
    }
  });

  // Parse kill events
  try {
    const kills = parseEvent(filePath, "player_death");
    kills.forEach(kill => {
      // CS2 uses different field names
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
  } catch (e) {
    // Silently continue if kill parsing fails
  }

  // Try multiple methods to get the final score
  
  // Method 1: Parse round_end events and count winners
  try {
    const roundEnds = parseEvent(filePath, "round_end");
    if (roundEnds && roundEnds.length > 0) {
      let ctWins = 0;
      let tWins = 0;
      
      roundEnds.forEach((round, idx) => {
        // CS2 team numbers: 2 = T, 3 = CT
        const winnerTeam = round.winner;
        let winner = null;
        if (winnerTeam === 2) {
          winner = "T";
          tWins++;
        } else if (winnerTeam === 3) {
          winner = "CT";
          ctWins++;
        }
        
        let reason = "elimination";
        const reasonCode = round.reason;
        if (reasonCode === 1) reason = "bomb_exploded";
        else if (reasonCode === 7) reason = "bomb_defused";
        else if (reasonCode === 8 || reasonCode === 9) reason = "elimination";
        else if (reasonCode === 12) reason = "time";
        
        result.rounds.push({
          roundNumber: idx + 1,
          winner,
          reason,
        });
      });
      
      result.scoreCT = ctWins;
      result.scoreT = tWins;
    }
  } catch (e) {
    // Continue to fallback
  }
  
  // Method 2: If no score yet, try parsing player tick data for team_rounds_total
  if (result.scoreCT === 0 && result.scoreT === 0) {
    try {
      // Get score from the last tick of the demo
      const fields = ["team_rounds_total", "team_num"];
      const tickData = parseTicks(filePath, fields);
      
      if (tickData && tickData.length > 0) {
        // Get the last entries for each team
        const lastTick = tickData[tickData.length - 1];
        
        // Find max scores across all data
        let maxCT = 0;
        let maxT = 0;
        
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
    } catch (e2) {
      // Continue to next fallback
    }
  }
  
  // Method 3: Try cs_win_panel_match event which fires at match end
  if (result.scoreCT === 0 && result.scoreT === 0) {
    try {
      const matchEnd = parseEvent(filePath, "cs_win_panel_match");
      if (matchEnd && matchEnd.length > 0) {
        const lastMatch = matchEnd[matchEnd.length - 1];
        result.scoreCT = lastMatch.ct_score || lastMatch.t2_score || 0;
        result.scoreT = lastMatch.t_score || lastMatch.t1_score || 0;
      }
    } catch (e3) {
      // Silently continue
    }
  }
  
  // Method 4: Count rounds from round_announce_match_start to end
  if (result.scoreCT === 0 && result.scoreT === 0 && result.rounds.length === 0) {
    try {
      const roundStarts = parseEvent(filePath, "round_start");
      if (roundStarts && roundStarts.length > 0) {
        // At minimum we know the match had this many rounds
        const totalRounds = roundStarts.length;
        // We can't determine winner without round_end, but at least show round count
        for (let i = 0; i < totalRounds; i++) {
          result.rounds.push({
            roundNumber: i + 1,
            winner: null,
            reason: "unknown",
          });
        }
      }
    } catch (e4) {
      // Silently continue
    }
  }

  // Update rounds played for each player
  const totalRounds = Math.max(result.rounds.length, 1);
  playerMap.forEach(p => {
    p.roundsPlayed = totalRounds;
  });

  // Convert to array and calculate derived stats
  result.players = Array.from(playerMap.values()).map(p => ({
    ...p,
    adr: p.roundsPlayed > 0 ? Math.round((p.damage || 0) / p.roundsPlayed) : 0,
    hsPercent: p.kills > 0 ? Math.round((p.headshots / p.kills) * 100) : 0,
    kd: p.deaths > 0 ? +(p.kills / p.deaths).toFixed(2) : p.kills,
  }));

  // Sort by kills desc
  result.players.sort((a, b) => b.kills - a.kills);

  console.log(JSON.stringify(result));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
