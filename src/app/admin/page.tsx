"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Loader2,
  Eye,
  Clock,
  CheckCircle,
  RefreshCw,
  DollarSign,
  XCircle,
  HelpCircle,
  Trash2,
  Crosshair,
} from "lucide-react";
import type { Submission, SubmissionStatus, SubmissionVerdict } from "@/types/database";
import { PremierRank, FaceitRank } from "@/components/ui/source-badges";
import { MapIcon } from "@/components/ui/map-icon";

// Inventory value color coding helper
function getInventoryStyle(valueCents: number): { text: string; bg: string; border: string } {
  if (valueCents >= 100000) { // >$1k - Gold/Whale
    return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" };
  }
  if (valueCents >= 10000) { // $100-$1k - Green/Mid
    return { text: "text-green-400", bg: "", border: "" };
  }
  // <$100 - Grey/Low
  return { text: "text-gray-500", bg: "", border: "" };
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  new: { label: "New", bg: "bg-blue-500/20", text: "text-blue-400", icon: Clock },
  reviewed: { label: "Reviewed", bg: "bg-green-500/20", text: "text-green-400", icon: CheckCircle },
};

const VERDICT_CONFIG: Record<SubmissionVerdict, { icon: typeof CheckCircle; color: string }> = {
  cheater: { icon: XCircle, color: "text-red-500" },
  clean: { icon: CheckCircle, color: "text-green-500" },
  inconclusive: { icon: HelpCircle, color: "text-yellow-500" },
};

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function AdminPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "all">("all");
  const [verdictFilter, setVerdictFilter] = useState<SubmissionVerdict | "all" | "pending">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  const isAdmin = session?.user?.role === "sparkles" || session?.user?.role === "moderator";

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (verdictFilter !== "all") {
        params.set("verdict", verdictFilter);
      }
      const res = await fetch(`/api/admin/submissions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
        setSelectedIds(new Set()); // Clear selection on refresh
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, verdictFilter]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === submissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(submissions.map(s => s.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} submission(s) permanently? This cannot be undone.`)) return;
    
    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/admin/submissions/${id}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);
      fetchSubmissions();
    } catch (error) {
      console.error("Bulk delete failed:", error);
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    if (authStatus === "unauthenticated" || (authStatus === "authenticated" && !isAdmin)) {
      router.push("/");
    }
  }, [authStatus, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchSubmissions();
    }
  }, [isAdmin, fetchSubmissions]);

  // Stats
  const stats = {
    new: submissions.filter((s) => s.status === "new").length,
    reviewed: submissions.filter((s) => s.status === "reviewed").length,
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <nav className="border-b border-gray-800/50 bg-[#0d0d14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
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
            <button
              onClick={() => {
                setLoading(true);
                fetchSubmissions();
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats bar and bulk actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-400">{stats.new} new</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-400">{stats.reviewed} reviewed</span>
            </div>
          </div>
          
          {/* Bulk actions */}
          {submissions.length > 0 && (
            <div className="flex items-center gap-3">
              {!selectionMode ? (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Select multiple
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedIds(new Set());
                    }}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={toggleSelectAll}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    {selectedIds.size === submissions.length ? "Deselect all" : "Select all"}
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-all"
                    >
                      {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete {selectedIds.size}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Status filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider self-center mr-1">Status:</span>
            {["all", ...Object.keys(STATUS_CONFIG)].map((status) => {
              const isAll = status === "all";
              const config = isAll ? null : STATUS_CONFIG[status as SubmissionStatus];
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as SubmissionStatus | "all")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
                    statusFilter === status
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-transparent border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {isAll ? "All" : config?.label}
                </button>
              );
            })}
          </div>
          
          {/* Verdict filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider self-center mr-1">Verdict:</span>
            {["all", "pending", "cheater", "clean", "inconclusive"].map((v) => {
              const isAll = v === "all";
              const isPending = v === "pending";
              const config = !isAll && !isPending ? VERDICT_CONFIG[v as SubmissionVerdict] : null;
              const Icon = config?.icon;
              return (
                <button
                  key={v}
                  onClick={() => setVerdictFilter(v as SubmissionVerdict | "all" | "pending")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
                    verdictFilter === v
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-transparent border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${config?.color}`} />}
                  {isAll ? "All" : isPending ? "Pending" : v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submissions Grid */}
        {submissions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-500">No submissions found</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {submissions.map((submission) => {
              const statusConfig = STATUS_CONFIG[submission.status];
              const verdictConfig = submission.verdict ? VERDICT_CONFIG[submission.verdict] : null;
              const VerdictIcon = verdictConfig?.icon;

              const isSelected = selectedIds.has(submission.id);
              
              return (
                <Link
                  key={submission.id}
                  href={`/admin/submissions/${submission.id}`}
                  className={`group flex flex-col bg-[#12121a] border rounded-xl overflow-hidden transition-all hover:bg-[#15151f] ${
                    isSelected ? "border-orange-500/50 ring-1 ring-orange-500/30" : "border-gray-800/50 hover:border-gray-700"
                  }`}
                  onClick={(e) => {
                    // Prevent navigation if clicking checkbox
                    if (selectionMode && (e.target as HTMLElement).closest('button')) {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* Card header with suspect info */}
                  <div className="p-4 pb-3">
                    {/* Top row: Avatar + Name on left, Rank on right */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Checkbox - only in selection mode */}
                        {selectionMode && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSelection(submission.id);
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-1 ${
                              isSelected
                                ? "bg-orange-500 border-orange-500 text-white"
                                : "border-gray-600 hover:border-gray-400"
                            }`}
                          >
                            {isSelected && <CheckCircle className="w-3 h-3" />}
                          </button>
                        )}
                        
                        {submission.suspected_avatar_url ? (
                          <img
                            src={submission.suspected_avatar_url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover ring-2 ring-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-600 text-lg">?</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">
                              {submission.suspected_persona_name || "Unknown"}
                            </p>
                            {VerdictIcon && (
                              <VerdictIcon className={`w-4 h-4 flex-shrink-0 ${verdictConfig?.color}`} />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {submission.suspected_steamid64 || "No Steam ID"}
                          </p>
                          {/* Inventory value - color coded, or private indicator */}
                          {submission.inventory_value_error?.toLowerCase().includes("private") ? (
                            <div className="inline-flex items-center gap-1 mt-1 text-yellow-500">
                              <span className="text-xs">🔒</span>
                              <span className="text-xs font-medium">Private</span>
                            </div>
                          ) : submission.inventory_value_cents !== null && submission.inventory_value_cents > 0 ? (() => {
                            const invStyle = getInventoryStyle(submission.inventory_value_cents);
                            const isHighValue = submission.inventory_value_cents >= 100000;
                            return (
                              <div className={`inline-flex items-center gap-0.5 mt-1 ${isHighValue ? `px-1.5 py-0.5 rounded ${invStyle.bg} border ${invStyle.border}` : ""}`}>
                                <DollarSign className={`w-3 h-3 ${invStyle.text}`} />
                                <span className={`text-xs font-medium tabular-nums ${invStyle.text}`}>
                                  {(submission.inventory_value_cents / 100).toLocaleString()}
                                </span>
                              </div>
                            );
                          })() : null}
                        </div>
                      </div>
                      
                      {/* Rank badge - top right */}
                      <div className="flex-shrink-0">
                        {submission.source === "premier" && submission.match_rank_or_elo ? (
                          <PremierRank rating={submission.match_rank_or_elo} size="sm" />
                        ) : submission.source === "faceit" && submission.match_rank_or_elo ? (
                          <FaceitRank 
                            level={parseInt(submission.match_rank_or_elo.replace(/\D/g, "")) || 1} 
                            size="sm" 
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col flex-grow">
                    {/* Reason preview */}
                    <div className="px-4 pb-3 flex-grow">
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {submission.suspicion_reason || "No reason provided"}
                      </p>
                      {/* Admin notes preview */}
                      {submission.admin_notes && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-1 italic">
                          📝 {submission.admin_notes}
                        </p>
                      )}
                    </div>

                    {/* Footer with metadata - always at bottom */}
                    <div className="px-4 py-3 bg-[#0d0d14] border-t border-gray-800/50 flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-3">
                        {/* Verdict indicator - dot with label */}
                        {submission.verdict ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            submission.verdict === "cheater" ? "text-red-400" :
                            submission.verdict === "clean" ? "text-green-400" :
                            "text-yellow-400"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${
                              submission.verdict === "cheater" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" :
                              submission.verdict === "clean" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                              "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                            }`} />
                            {submission.verdict.charAt(0).toUpperCase() + submission.verdict.slice(1)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                            Pending
                          </span>
                        )}
                        {/* Status indicator */}
                        {submission.status === "new" && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            New
                          </span>
                        )}
                        {/* Map icon */}
                        {submission.map && (
                          <MapIcon map={submission.map} size="sm" />
                        )}
                      </div>
                      {/* Age indicator */}
                      <span className="text-xs text-gray-600">
                        {getRelativeTime(submission.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
