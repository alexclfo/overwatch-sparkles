// Test script for CS2 demo parsing using @laihoe/demoparser2
const { parseEvent, parseHeader, listGameEvents } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = process.argv[2];
if (!demoPath) {
  console.error('Usage: node test-cs2-parser.js <path-to-demo.dem>');
  process.exit(1);
}

console.log('Parsing CS2 demo:', demoPath);
console.log('='.repeat(60));

try {
  // Parse header for basic info
  console.log('\n--- HEADER ---');
  const header = parseHeader(demoPath);
  console.log(JSON.stringify(header, null, 2));

  // List available game events
  console.log('\n--- AVAILABLE EVENTS ---');
  const events = listGameEvents(demoPath);
  console.log('Total events:', events.length);
  console.log('Sample events:', events.slice(0, 20));

  // Parse round_end to get players
  console.log('\n--- ROUND END EVENTS ---');
  try {
    const roundEnd = parseEvent(demoPath, 'round_end');
    console.log('Round ends:', roundEnd.length);
    if (roundEnd.length > 0) {
      console.log('First round_end:', JSON.stringify(roundEnd[0], null, 2));
    }
  } catch (e) {
    console.log('No round_end events:', e.message);
  }

  // Parse player_death to get player info
  console.log('\n--- PLAYER DEATH EVENTS (first 3) ---');
  try {
    const deaths = parseEvent(demoPath, 'player_death', [
      'user_name', 
      'user_steamid',
      'attacker_name',
      'attacker_steamid',
      'weapon',
      'headshot'
    ]);
    console.log('Total deaths:', deaths.length);
    if (deaths.length > 0) {
      deaths.slice(0, 3).forEach((d, i) => {
        console.log(`Death ${i + 1}:`, JSON.stringify(d, null, 2));
      });
    }
  } catch (e) {
    console.log('player_death error:', e.message);
  }

  // Try to get player spawn or player_connect events
  console.log('\n--- PLAYER SPAWN EVENTS ---');
  try {
    const spawns = parseEvent(demoPath, 'player_spawn', [
      'user_name',
      'user_steamid',
      'user_team_name'
    ]);
    console.log('Total spawns:', spawns.length);
    if (spawns.length > 0) {
      // Get unique players
      const players = new Map();
      spawns.forEach(s => {
        if (s.user_steamid && !players.has(s.user_steamid)) {
          players.set(s.user_steamid, {
            name: s.user_name,
            steamid: s.user_steamid,
            team: s.user_team_name
          });
        }
      });
      console.log('Unique players:');
      players.forEach((p, id) => console.log(`  ${p.name} (${id}) - ${p.team}`));
    }
  } catch (e) {
    console.log('player_spawn error:', e.message);
  }

  // Try round_start for map info
  console.log('\n--- ROUND START EVENTS ---');
  try {
    const roundStart = parseEvent(demoPath, 'round_start');
    console.log('Round starts:', roundStart.length);
    if (roundStart.length > 0) {
      console.log('First:', JSON.stringify(roundStart[0], null, 2));
    }
  } catch (e) {
    console.log('round_start error:', e.message);
  }

  // Try begin_new_match
  console.log('\n--- BEGIN_NEW_MATCH ---');
  try {
    const matchStart = parseEvent(demoPath, 'begin_new_match');
    console.log('Match starts:', matchStart.length);
    if (matchStart.length > 0) {
      console.log('First:', JSON.stringify(matchStart[0], null, 2));
    }
  } catch (e) {
    console.log('begin_new_match error:', e.message);
  }

} catch (error) {
  console.error('Parse error:', error);
}
