"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Download,
  ExternalLink,
  RefreshCw,
  DollarSign,
  CheckCircle,
  HelpCircle,
  Trash2,
  Crosshair,
  Skull,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import type { Submission, SubmissionVerdict } from "@/types/database";
import { MatchSummary } from "@/components/ui/match-summary";
import { PremierRank, FaceitRank } from "@/components/ui/source-badges";
import { MapIcon } from "@/components/ui/map-icon";

const VERDICT_OPTIONS: { value: SubmissionVerdict | "none"; label: string; icon: typeof CheckCircle; color: string }[] = [
  { value: "none", label: "Pending", icon: HelpCircle, color: "bg-gray-700 text-gray-300" },
  { value: "cheater", label: "Cheater", icon: Skull, color: "bg-red-500/20 text-red-400 border-red-500/50" },
  { value: "clean", label: "Clean", icon: ShieldCheck, color: "bg-green-500/20 text-green-400 border-green-500/50" },
  { value: "inconclusive", label: "Inconclusive", icon: AlertTriangle, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" },
];

function CopySteamIdButton({ steamId }: { steamId: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(steamId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      title="Copy SteamID64"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span>Copy ID</span>
        </>
      )}
    </button>
  );
}

export default function SubmissionDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const submissionId = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingInventory, setRefreshingInventory] = useState(false);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const [topItems, setTopItems] = useState<{ name: string; price_cents: number; icon_url: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [savedVerdict, setSavedVerdict] = useState<string | null>(null);
  const [banInfo, setBanInfo] = useState<{ vacBanned: boolean; gameBans: number; daysSinceLastBan: number } | null>(null);
  const [faceitInfo, setFaceitInfo] = useState<{ found: boolean; data: { nickname: string; skill_level: number; elo: number; region: string } | null } | null>(null);

  const [verdict, setVerdict] = useState<SubmissionVerdict | "none">("none");
  const [adminNotes, setAdminNotes] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesTimer, setNotesTimer] = useState<NodeJS.Timeout | null>(null);

  const isAdmin = session?.user?.role === "sparkles" || session?.user?.role === "moderator";

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`);
      if (res.status === 404) {
        // Submission not found - redirect to admin
        router.push("/admin");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
        setVerdict(data.submission.verdict || "none");
        setAdminNotes(data.submission.admin_notes || "");
        
        // Load stored top items from database
        if (data.submission.inventory_top_items) {
          setTopItems(data.submission.inventory_top_items);
        }
        
        // Show inventory error if exists (e.g., "private")
        if (data.submission.inventory_value_error) {
          setInventoryMessage(data.submission.inventory_value_error);
        }
        
        // Fetch ban info and FACEIT info if we have a Steam ID
        if (data.submission.suspected_steamid64) {
          fetchBanInfo(data.submission.suspected_steamid64);
          fetchFaceitInfo(data.submission.suspected_steamid64);
        }
      }
    } catch (error) {
      console.error("Failed to fetch submission:", error);
    } finally {
      setLoading(false);
    }
  }, [submissionId, router]);

  const fetchBanInfo = async (steamId64: string) => {
    try {
      const res = await fetch(`/api/steam/bans?steamid=${steamId64}`);
      if (res.ok) {
        const data = await res.json();
        if (data.bans && data.bans.length > 0) {
          const ban = data.bans[0];
          setBanInfo({
            vacBanned: ban.VACBanned,
            gameBans: ban.NumberOfGameBans,
            daysSinceLastBan: ban.DaysSinceLastBan,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch ban info:", error);
    }
  };

  const fetchFaceitInfo = async (steamId64: string) => {
    try {
      const res = await fetch(`/api/steam/faceit?steamId=${steamId64}`);
      if (res.ok) {
        const data = await res.json();
        setFaceitInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch FACEIT info:", error);
    }
  };

  useEffect(() => {
    if (authStatus === "unauthenticated" || (authStatus === "authenticated" && !isAdmin)) {
      router.push("/");
    }
  }, [authStatus, isAdmin, router]);

  useEffect(() => {
    if (isAdmin && submissionId) {
      fetchSubmission();
    }
  }, [isAdmin, submissionId, fetchSubmission]);

  // Keyboard shortcuts for quick verdict selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "1":
          setVerdict("cheater");
          handleSave("cheater");
          break;
        case "2":
          setVerdict("clean");
          handleSave("clean");
          break;
        case "3":
          setVerdict("inconclusive");
          handleSave("inconclusive");
          break;
        case "escape":
          setShowDeleteConfirm(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adminNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (newVerdict?: SubmissionVerdict | "none") => {
    setSaving(true);
    const v = newVerdict ?? verdict;
    // Status is "reviewed" if verdict is set, otherwise "new"
    const newStatus = v !== "none" ? "reviewed" : "new";
    
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          verdict: v === "none" ? null : v,
          admin_notes: adminNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
        setVerdict(v);
        if (v !== "none") {
          setSavedVerdict(v);
          setTimeout(() => setSavedVerdict(null), 2000);
        }
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this submission permanently? This cannot be undone.")) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/admin");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshInventory = async () => {
    setRefreshingInventory(true);
    setInventoryMessage(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/inventory`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSubmission();
        if (data.top_items) {
          setTopItems(data.top_items);
        }
        if (data.error) {
          setInventoryMessage(`Error: ${data.error}`);
        } else if (data.value_cents !== null) {
          setInventoryMessage(`Updated: $${(data.value_cents / 100).toFixed(2)}`);
        }
      } else {
        setInventoryMessage(`Failed: ${data.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Failed to refresh inventory:", error);
      setInventoryMessage("Network error");
    } finally {
      setRefreshingInventory(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Header - always show during loading */}
        <nav className="border-b border-white/5 bg-[#0d0d14]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Crosshair className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="font-bold text-white">SPARKLES</span>
                  <span className="font-light text-gray-400 ml-1">OVERWATCH</span>
                </div>
              </div>
              <div className="w-10" /> {/* Spacer */}
            </div>
          </div>
        </nav>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (!isAdmin || !submission) {
    return null;
  }

  const currentVerdict = VERDICT_OPTIONS.find((v) => v.value === verdict) || VERDICT_OPTIONS[0];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <nav className="border-b border-white/5 bg-[#0d0d14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-white">SPARKLES</span>
                <span className="font-light text-gray-400 ml-1">OVERWATCH</span>
              </div>
            </div>
            {/* Header actions - Refresh only */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefreshInventory}
                disabled={refreshingInventory}
                className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Refresh Inventory"
              >
                {refreshingInventory ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Suspect Hero Card */}
        <div className="bg-gradient-to-br from-[#12121a] to-[#0d0d14] border border-white/5 rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              {submission.suspected_avatar_url ? (
                <img
                  src={submission.suspected_avatar_url}
                  alt=""
                  className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gray-800 flex items-center justify-center ring-4 ring-white/10">
                  <Crosshair className="w-10 h-10 text-gray-600" />
                </div>
              )}
              {/* Inventory badge - color coded with glow for high value */}
              {submission.inventory_value_cents !== null && (
                <div 
                  className={`absolute -bottom-2 -right-2 flex items-center gap-1 font-bold rounded-lg ${
                    submission.inventory_value_cents === 0 
                      ? "px-2 py-1 text-xs bg-gray-700 text-gray-400" 
                      : submission.inventory_value_cents >= 100000 
                        ? "px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 border border-yellow-500/50" 
                        : "px-2 py-1 text-xs bg-green-500 text-white"
                  }`}
                  style={submission.inventory_value_cents >= 100000 ? {
                    boxShadow: '0 0 15px rgba(250, 204, 21, 0.3), 0 0 30px rgba(250, 204, 21, 0.15)'
                  } : {}}
                >
                  <DollarSign className={submission.inventory_value_cents >= 100000 ? "w-4 h-4" : "w-3 h-3"} />
                  {(submission.inventory_value_cents / 100).toLocaleString()}
                </div>
              )}
            </div>

            {/* Suspect Info - Refactored layout */}
            <div className="flex-1">
              {/* Row 1: Username + Steam link */}
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white">
                  {submission.suspected_persona_name || "Unknown Player"}
                </h1>
                {submission.suspected_steamid64 && (
                  <a
                    href={`https://steamcommunity.com/profiles/${submission.suspected_steamid64}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    title="View Steam Profile"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.08.16-1.53.45L2 10.08A10 10 0 0 1 12 2m5.23 10.58c0-1.34 1.09-2.43 2.43-2.43s2.43 1.09 2.43 2.43-1.09 2.43-2.43 2.43-2.43-1.09-2.43-2.43m-9.85 3.39c0 1.01.82 1.83 1.83 1.83s1.83-.82 1.83-1.83-.82-1.83-1.83-1.83-1.83.82-1.83 1.83z"/>
                    </svg>
                  </a>
                )}
              </div>
              
              {/* Row 2: SteamID + Copy button */}
              {submission.suspected_steamid64 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-500 font-mono">
                    {submission.suspected_steamid64}
                  </span>
                  <CopySteamIdButton steamId={submission.suspected_steamid64} />
                </div>
              )}
              
              {/* Row 3: Map, Rank, Ban status */}
              <div className="flex flex-wrap items-center gap-4">
                {submission.map && (
                  <MapIcon map={submission.map} size="md" showName />
                )}
                {/* Rank display */}
                {submission.source === "premier" && submission.match_rank_or_elo ? (
                  <PremierRank rating={submission.match_rank_or_elo} size="md" />
                ) : submission.source === "faceit" && submission.match_rank_or_elo ? (
                  <FaceitRank 
                    level={parseInt(submission.match_rank_or_elo.replace(/\D/g, "")) || 1} 
                    size="md" 
                  />
                ) : null}
                {/* Ban Status */}
                {banInfo && (banInfo.vacBanned || banInfo.gameBans > 0) && (
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/20 text-red-400 text-sm font-medium">
                    ⚠️ {banInfo.vacBanned ? "VAC Banned" : ""} 
                    {banInfo.gameBans > 0 ? `${banInfo.gameBans} Game Ban${banInfo.gameBans > 1 ? "s" : ""}` : ""}
                    {banInfo.daysSinceLastBan > 0 && ` (${banInfo.daysSinceLastBan}d ago)`}
                  </span>
                )}
                {banInfo && !banInfo.vacBanned && banInfo.gameBans === 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-green-400">
                    ✓ No bans
                  </span>
                )}
              </div>
            </div>

            {/* Inventory Fetch/Refresh */}
            <div className="text-right">
              <button
                onClick={handleRefreshInventory}
                disabled={refreshingInventory}
                className={`flex items-center gap-2 text-sm transition-colors ml-auto ${
                  submission.inventory_value_cents !== null 
                    ? "text-gray-500 hover:text-white" 
                    : "text-orange-400 hover:text-orange-300 font-medium"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshingInventory ? "animate-spin" : ""}`} />
                {submission.inventory_value_cents !== null ? "Refresh Inventory" : "Get Inventory"}
              </button>
              {inventoryMessage && (
                <p className={`text-xs mt-1 ${
                  inventoryMessage.toLowerCase().includes("private") 
                    ? "text-yellow-400" 
                    : inventoryMessage.toLowerCase().includes("error") || inventoryMessage.toLowerCase().includes("failed")
                      ? "text-red-400" 
                      : "text-green-400"
                }`}>
                  {inventoryMessage.toLowerCase().includes("private") ? "🔒 " : ""}{inventoryMessage}
                </p>
              )}
              {submission.inventory_value_error && !inventoryMessage && submission.inventory_value_updated_at && (
                <p className={`text-xs mt-1 ${
                  submission.inventory_value_error.toLowerCase().includes("private") 
                    ? "text-yellow-400" 
                    : "text-red-400"
                }`}>
                  {submission.inventory_value_error.toLowerCase().includes("private") 
                    ? "🔒 Inventory is private" 
                    : submission.inventory_value_error}
                </p>
              )}
              {submission.inventory_value_updated_at && (
                <p className="text-xs text-gray-600 mt-1">
                  Updated: {new Date(submission.inventory_value_updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Top Inventory Items */}
          {topItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Top Items</h3>
              <div className="flex gap-3">
                {topItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2 flex-1">
                    <img 
                      src={item.icon_url} 
                      alt={item.name}
                      className="w-12 h-12 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 truncate" title={item.name}>
                        {item.name.length > 25 ? item.name.substring(0, 22) + "..." : item.name}
                      </p>
                      <p className="text-sm font-bold text-green-400">
                        ${(item.price_cents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Suspicion Reason */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Suspicion Reason</h2>
              <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                {submission.suspicion_reason || "No reason provided"}
              </p>
              {submission.must_check_rounds && submission.must_check_rounds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <span className="text-sm text-gray-500">Rounds to check: </span>
                  <span className="flex flex-wrap gap-1.5 mt-2">
                    {submission.must_check_rounds.map((round) => (
                      <span key={round} className="text-sm text-white font-medium bg-orange-500/20 px-2 py-0.5 rounded">
                        {round}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Demo Download */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Demo File</h2>
                  <p className="font-medium text-white">{submission.demo_original_filename}</p>
                  <p className="text-sm text-gray-500">
                    {submission.demo_size_bytes
                      ? `${(submission.demo_size_bytes / 1024 / 1024).toFixed(1)} MB`
                      : "Unknown size"}
                  </p>
                </div>
                <a
                  href={`/api/admin/submissions/${submissionId}/download`}
                  onClick={() => {
                    setDownloading(true);
                    setTimeout(() => setDownloading(false), 5000);
                  }}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-orange-500/20 ${
                    downloading 
                      ? "bg-gray-600 cursor-wait" 
                      : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500"
                  }`}
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download
                    </>
                  )}
                </a>
              </div>
            </div>

            {/* Match Summary - Collapsible */}
            <MatchSummary 
              submissionId={submissionId} 
              suspectSteamId={submission.suspected_steamid64}
            />

            {/* Admin Notes - Auto-save with indicator */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Notes</h2>
                <div className="h-5">
                  {saving && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </span>
                  )}
                  {notesSaved && !saving && (
                    <span className="text-xs text-green-400 flex items-center gap-1 transition-opacity duration-300">
                      <Check className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>
              </div>
              <textarea
                value={adminNotes}
                onChange={(e) => {
                  setAdminNotes(e.target.value);
                  setNotesSaved(false);
                  // Debounced auto-save
                  if (notesTimer) clearTimeout(notesTimer);
                  const timer = setTimeout(() => {
                    handleSave();
                    setNotesSaved(true);
                    setTimeout(() => setNotesSaved(false), 2000);
                  }, 1000);
                  setNotesTimer(timer);
                }}
                placeholder="Add notes about this case..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white resize-none"
              />
              <p className="mt-2 text-xs text-gray-600">Auto-saves after you stop typing</p>
            </div>
          </div>

          {/* Right Column - Verdict & Meta - Sticky for rapid review */}
          <div className="space-y-6 lg:sticky lg:top-20 h-fit">
            {/* Verdict Buttons */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Verdict</h2>
                {savedVerdict && (
                  <span className="text-xs text-green-400 flex items-center gap-1 animate-pulse">
                    <CheckCircle className="w-3 h-3" /> Saved!
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {VERDICT_OPTIONS.filter((v) => v.value !== "none").map((option) => {
                  const Icon = option.icon;
                  const isSelected = verdict === option.value;
                  const justSaved = savedVerdict === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setVerdict(option.value);
                        handleSave(option.value);
                      }}
                      disabled={saving}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `${option.color} border-current ring-2 ring-current/30`
                          : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600"
                      } ${justSaved ? "scale-[1.02]" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-semibold">{option.label}</span>
                      {isSelected && (
                        <span className="ml-auto flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {justSaved && <span className="text-xs">Saved</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {verdict !== "none" && !saving && (
                <button
                  onClick={() => {
                    setVerdict("none");
                    handleSave("none");
                  }}
                  className="mt-3 text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Clear verdict
                </button>
              )}
            </div>

            {/* FACEIT Stats */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">FACEIT Stats</h2>
              {faceitInfo === null ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : faceitInfo.found && faceitInfo.data ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Nickname</span>
                    <span className="text-sm font-medium text-white">{faceitInfo.data.nickname}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Level</span>
                    <span className={`text-sm font-bold ${
                      faceitInfo.data.skill_level >= 8 ? "text-red-400" :
                      faceitInfo.data.skill_level >= 6 ? "text-orange-400" :
                      faceitInfo.data.skill_level >= 4 ? "text-yellow-400" :
                      "text-green-400"
                    }`}>
                      Level {faceitInfo.data.skill_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">ELO</span>
                    <span className="text-sm font-bold text-orange-400">{faceitInfo.data.elo.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Region</span>
                    <span className="text-sm text-gray-300">{faceitInfo.data.region}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No FACEIT account linked</p>
              )}
            </div>

            {/* Submitter Info */}
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-6">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Submitted By</h2>
              <div className="flex items-center gap-3">
                {submission.submitter_avatar_url ? (
                  <img
                    src={submission.submitter_avatar_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500">
                    {submission.submitter_persona_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">
                    {submission.submitter_persona_name || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {submission.submitter_steamid64}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 text-sm text-gray-500">
                <p>{new Date(submission.created_at).toLocaleString()}</p>
              </div>
            </div>


            {/* Delete Submission - Bottom of right column */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete Submission
            </button>

            {/* ID */}
            <div className="text-xs text-gray-600 font-mono break-all px-2 text-center">
              {submission.id}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Delete Submission</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Type <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoFocus
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-white mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText !== "DELETE"}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                  deleteConfirmText === "DELETE"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-800 text-gray-600 cursor-not-allowed"
                }`}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
