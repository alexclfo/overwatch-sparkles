const express = require('express');
const { parseHeader, parsePlayerInfo } = require('@laihoe/demoparser2');
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Parse demo endpoint
app.post('/parse', authenticate, async (req, res) => {
  let tempDir = null;
  
  try {
    const { demoBuffer } = req.body;
    
    if (!demoBuffer) {
      return res.status(400).json({ error: 'Missing demoBuffer' });
    }

    // Decode base64 buffer
    const buffer = Buffer.from(demoBuffer, 'base64');
    
    // Write to temp file
    tempDir = mkdtempSync(join(tmpdir(), 'demo-'));
    const tempFile = join(tempDir, 'demo.dem');
    writeFileSync(tempFile, buffer);

    // Parse demo
    const result = {
      map: null,
      players: [],
      serverName: null,
    };

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

    // Clean up
    try {
      unlinkSync(tempFile);
      rmdirSync(tempDir);
    } catch {}

    res.json(result);
  } catch (error) {
    console.error('Parse error:', error);
    
    // Clean up on error
    if (tempDir) {
      try {
        unlinkSync(join(tempDir, 'demo.dem'));
        rmdirSync(tempDir);
      } catch {}
    }
    
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});
