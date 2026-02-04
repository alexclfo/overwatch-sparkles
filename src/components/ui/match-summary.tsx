"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface PlayerStats {
  name: string;
  steamId64: string;
  team: "CT" | "T" | "SPEC";
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  hsPercent: number;
  kd: number;
  adr?: number;
}

interface RoundInfo {
  roundNumber: number;
  winner: "CT" | "T" | null;
  reason: string;
}

interface MatchStats {
  map: string | null;
  serverName: string | null;
  scoreCT: number;
  scoreT: number;
  duration: number | null;
  rounds: RoundInfo[];
  players: PlayerStats[];
}

interface MatchSummaryProps {
  submissionId: string;
  suspectSteamId?: string | null;
}

export function MatchSummary({ submissionId, suspectSteamId }: MatchSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    if (stats) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setExpanded(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load stats");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const ctPlayers = stats?.players.filter(p => p.team === "CT") || [];
  const tPlayers = stats?.players.filter(p => p.team === "T") || [];

  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={loadStats}
        disabled={loading}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Match Details</h2>
          {stats && (
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">{stats.scoreCT}</span>
              <span className="text-gray-600">-</span>
              <span className="text-orange-400 font-bold">{stats.scoreT}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : expanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Error state */}
      {error && (
        <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && stats && (
        <div className="border-t border-white/5">
          {/* Score header - simplified with Team 1/Team 2 */}
          <div className="px-6 py-4 bg-gradient-to-r from-cyan-500/10 via-transparent to-orange-500/10">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-xs text-cyan-400 uppercase tracking-wider mb-1">Team 1</p>
                <p className="text-4xl font-bold text-cyan-400">{stats.scoreCT}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl text-gray-600">vs</p>
                {stats.duration && (
                  <p className="text-xs text-gray-600">{formatDuration(stats.duration)}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">Team 2</p>
                <p className="text-4xl font-bold text-orange-400">{stats.scoreT}</p>
              </div>
            </div>
          </div>

          {/* Scoreboard - CS2 Style Table */}
          <div className="border-t border-white/5">
            {/* Team 1 (CT) */}
            <div className="bg-blue-500/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blue-500/20">
                    <th className="px-4 py-2 text-left text-xs font-medium text-blue-400 uppercase tracking-wider">Team 1</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">K / A / D</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">+/-</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">HS%</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {ctPlayers.map((player) => (
                    <ScoreboardRow 
                      key={player.steamId64} 
                      player={player} 
                      isSuspect={player.steamId64 === suspectSteamId}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Team 2 (T) */}
            <div className="bg-orange-500/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-orange-500/20">
                    <th className="px-4 py-2 text-left text-xs font-medium text-orange-400 uppercase tracking-wider">Team 2</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">K / A / D</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">+/-</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">HS%</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {tPlayers.map((player) => (
                    <ScoreboardRow 
                      key={player.steamId64} 
                      player={player} 
                      isSuspect={player.steamId64 === suspectSteamId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreboardRow({ 
  player, 
  isSuspect 
}: { 
  player: PlayerStats; 
  isSuspect: boolean;
}) {
  const plusMinus = player.kills - player.deaths;
  const plusMinusColor = plusMinus > 0 ? "text-green-400" : plusMinus < 0 ? "text-red-400" : "text-gray-500";

  return (
    <tr 
      className={`border-b border-white/5 ${
        isSuspect 
          ? "bg-red-500/10 border-l-4 border-l-red-500" 
          : ""
      }`}
    >
      <td className="px-4 py-2">
        <span className={`font-medium ${isSuspect ? "text-red-400" : "text-white"}`}>
          {player.name}
          {isSuspect && <span className="ml-2 text-xs text-red-400/70">(Suspect)</span>}
        </span>
      </td>
      <td className="px-2 py-2 text-center font-mono text-sm tabular-nums">
        <span className="text-white">{player.kills}</span>
        <span className="text-gray-600 mx-1">/</span>
        <span className="text-gray-400">{player.assists}</span>
        <span className="text-gray-600 mx-1">/</span>
        <span className="text-gray-400">{player.deaths}</span>
      </td>
      <td className={`px-2 py-2 text-center font-mono text-sm tabular-nums font-medium ${plusMinusColor}`}>
        {plusMinus > 0 ? "+" : ""}{plusMinus}
      </td>
      <td className="px-2 py-2 text-center font-mono text-sm tabular-nums text-gray-400">
        {player.hsPercent}%
      </td>
      <td className="px-2 py-2 text-center font-mono text-sm tabular-nums text-gray-400">
        {player.adr || 0}
      </td>
    </tr>
  );
}
