"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Upload,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Users,
  Target,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import type { DemoSource } from "@/types/database";
import { RankSelector } from "@/components/ui/rank-badge";

// Cheat type options
const CHEAT_TYPES = [
  { id: "wallhack", label: "Wallhack" },
  { id: "aimbot", label: "Aimbot" },
  { id: "spinbot", label: "Spinbot" },
  { id: "external", label: "External Assist" },
  { id: "griefing", label: "Griefing" },
];

// Slide animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const CS2_MAPS = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_vertigo",
  "de_train",
  "Other",
];

interface DemoPlayer {
  name: string;
  steamId64: string | null;
  team: string;
  kills?: number;
  deaths?: number;
  kd?: number;
}

interface DemoInfo {
  map: string | null;
  players: DemoPlayer[];
}

type WizardStep = "upload" | "inspect" | "details";

export default function SubmitPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadData, setUploadData] = useState<{ submissionId: string; objectKey: string } | null>(null);
  
  // Demo inspection state
  const [inspecting, setInspecting] = useState(false);
  const [demoInfo, setDemoInfo] = useState<DemoInfo | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  
  // Form state
  const [source, setSource] = useState<DemoSource>("premier");
  const [map, setMap] = useState("");
  const [rating, setRating] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<DemoPlayer | null>(null);
  const [manualSteamUrl, setManualSteamUrl] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [startTick, setStartTick] = useState("");
  const [suspicionReason, setSuspicionReason] = useState("");
  const [cheatTypes, setCheatTypes] = useState<string[]>([]);
  const [slideDirection, setSlideDirection] = useState(1);
  
  // General state
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 500 * 1024 * 1024) {
        setError("File size exceeds 500MB limit");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Get presigned URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      if (!presignRes.ok) {
        const data = await presignRes.json();
        throw new Error(data.error || "Failed to get upload URL");
      }

      const { uploadUrl, objectKey, submissionId } = await presignRes.json();
      setUploadProgress(20);

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file. Check your connection and try again.");
      }

      setUploadProgress(100);
      setUploadComplete(true);
      setUploadData({ submissionId, objectKey });
      
      // Move to inspect step
      setStep("inspect");
      
      // Try to inspect demo
      inspectDemo(objectKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const inspectDemo = async (objectKey: string) => {
    setInspecting(true);
    setInspectError(null);

    try {
      const res = await fetch("/api/demos/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey }),
      });

      if (!res.ok) {
        throw new Error("Could not analyze demo");
      }

      const data = await res.json();
      setDemoInfo(data);
      
      // Auto-fill map if detected
      if (data.map) {
        const matchedMap = CS2_MAPS.find(m => m.toLowerCase() === data.map.toLowerCase());
        if (matchedMap) {
          setMap(matchedMap);
        }
      }
    } catch {
      setInspectError("Could not extract info from demo. Please fill in manually.");
      setShowManualEntry(true);
    } finally {
      setInspecting(false);
    }
  };

  const handleSubmit = async () => {
    if (!uploadData) return;
    
    // Validation
    if (!map) {
      setError("Please select a map");
      return;
    }
    if (!rating) {
      setError("Please enter rating/rank");
      return;
    }
    if (!selectedPlayer && !manualSteamUrl) {
      setError("Please select a suspect or enter Steam URL");
      return;
    }
    if (!suspicionReason) {
      setError("Please describe why you think they're cheating");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/submissions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: uploadData.submissionId,
          objectKey: uploadData.objectKey,
          filename: file?.name,
          size: file?.size,
          contentType: file?.type || "application/octet-stream",
          source,
          map,
          match_rank_or_elo: rating,
          suspected_steamid64: selectedPlayer?.steamId64 || null,
          suspected_profile_url: manualSteamUrl || null,
          spectate_player: selectedPlayer?.name || manualSteamUrl,
          start_tick_or_round: startTick || null,
          suspicion_reason: suspicionReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      router.push(`/submit/success?id=${uploadData.submissionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep("upload");
    setFile(null);
    setUploadComplete(false);
    setUploadData(null);
    setDemoInfo(null);
    setMap("");
    setRating("");
    setSelectedPlayer(null);
    setManualSteamUrl("");
    setShowManualEntry(false);
    setStartTick("");
    setSuspicionReason("");
    setCheatTypes([]);
    setError(null);
  };

  const goToStep = (newStep: WizardStep) => {
    const stepOrder = ["upload", "inspect", "details"];
    const currentIndex = stepOrder.indexOf(step);
    const newIndex = stepOrder.indexOf(newStep);
    setSlideDirection(newIndex > currentIndex ? 1 : -1);
    setStep(newStep);
  };

  const toggleCheatType = (id: string) => {
    setCheatTypes(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // Keyboard support - Enter to continue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (step === "upload" && file && !uploading) {
          handleUpload();
        } else if (step === "inspect" && map && (selectedPlayer || manualSteamUrl) && !inspecting) {
          goToStep("details");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, file, uploading, map, selectedPlayer, manualSteamUrl, inspecting]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const steps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "inspect", label: "Review", icon: Users },
    { id: "details", label: "Submit", icon: Target },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <nav className="border-b border-gray-800/50 bg-[#0d0d14]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Cancel</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-white">Submit Demo</span>
            </div>
            <button onClick={resetWizard} className="text-gray-500 hover:text-white transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Progress Steps */}
      <div className="border-b border-gray-800/50 bg-[#0d0d14]/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isCurrent = s.id === step;
              const isPast = steps.findIndex(x => x.id === step) > i;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isCurrent ? "bg-orange-500/20 text-orange-400" :
                    isPast ? "text-green-400" : "text-gray-600"
                  }`}>
                    {isPast ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className={`w-4 h-4 mx-2 ${isPast ? "text-green-400" : "text-gray-700"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Upload Demo File</h1>
              <p className="text-gray-400">Select your CS2 or Faceit demo file</p>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                file
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-gray-700 hover:border-gray-600 bg-[#12121a]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".dem"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{file.name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-white font-medium mb-1">Click to select .dem file</p>
                  <p className="text-sm text-gray-500">Maximum file size: 500MB</p>
                </>
              )}
            </div>

            {/* Source Selection */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-400 mb-3">Demo Source</label>
              <div className="flex gap-3">
                {[
                  { value: "premier", label: "PREMIER" },
                  { value: "faceit", label: "FACEIT" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value as DemoSource)}
                    className={`flex-1 py-3 rounded-lg font-medium transition-all border ${
                      source === opt.value
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                        : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-all flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Demo
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Inspect / Select Suspect */}
        {step === "inspect" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Select Suspect</h1>
              <p className="text-gray-400">Choose the player you want to report</p>
            </div>

            {inspecting ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
                <p className="text-gray-400">Analyzing demo file...</p>
              </div>
            ) : (
              <>
                {/* Map Selection */}
                <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
                  <label className="block text-sm font-medium text-gray-400 mb-3">Map</label>
                  <select
                    value={map}
                    onChange={(e) => setMap(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                  >
                    <option value="">Select map</option>
                    {CS2_MAPS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Players from Demo - Enhanced with K/D and custom scrollbar */}
                {demoInfo?.players && demoInfo.players.length > 0 && !showManualEntry && (
                  <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
                    <label className="block text-sm font-medium text-gray-400 mb-3">
                      Select Suspect from Match
                    </label>
                    <div className="grid gap-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
                      {demoInfo.players.map((player, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedPlayer(player)}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            selectedPlayer?.name === player.name
                              ? "bg-orange-500/20 border-orange-500/50"
                              : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            player.team === "CT" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                          }`}>
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{player.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className={player.team === "CT" ? "text-blue-400" : "text-orange-400"}>
                                {player.team}
                              </span>
                              {player.kills !== undefined && player.deaths !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">
                                    {player.kills}/{player.deaths}
                                    {player.kd !== undefined && (
                                      <span className={player.kd >= 1 ? "text-green-400 ml-1" : "text-red-400 ml-1"}>
                                        ({player.kd.toFixed(2)})
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {selectedPlayer?.name === player.name && (
                            <CheckCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Manual entry button - more prominent */}
                    <button
                      onClick={() => setShowManualEntry(true)}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-gray-400 hover:text-white transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      Player not listed? Enter manually
                    </button>
                  </div>
                )}

                {/* Manual Entry Fallback */}
                {(showManualEntry || inspectError || !demoInfo?.players?.length) && (
                  <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
                    {inspectError && (
                      <div className="flex items-center gap-2 mb-4 text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {inspectError}
                      </div>
                    )}
                    <label className="block text-sm font-medium text-gray-400 mb-3">
                      Suspect Steam Profile URL
                    </label>
                    <input
                      type="text"
                      value={manualSteamUrl}
                      onChange={(e) => setManualSteamUrl(e.target.value)}
                      placeholder="https://steamcommunity.com/profiles/... or /id/..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
                    />
                    {demoInfo?.players && demoInfo.players.length > 0 && (
                      <button
                        onClick={() => setShowManualEntry(false)}
                        className="mt-3 text-sm text-gray-400 hover:text-white"
                      >
                        ← Back to player list
                      </button>
                    )}
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={() => goToStep("details")}
                  disabled={!map || (!selectedPlayer && !manualSteamUrl)}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-all flex items-center justify-center gap-3"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 3: Final Details */}
        {step === "details" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Final Details</h1>
              <p className="text-gray-400">Add context for the review</p>
            </div>

            {/* Selected Suspect Preview */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-400 mb-3">Suspect</label>
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-white">
                    {selectedPlayer?.name || manualSteamUrl || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {map} • {source.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setStep("inspect")}
                  className="ml-auto text-sm text-gray-400 hover:text-white"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Compact Rank Input */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <RankSelector
                value={rating}
                onChange={setRating}
                source={source}
              />
            </div>

            {/* Suspected Cheat Types - Pill selection */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Suspected Cheat Type
              </label>
              <div className="flex flex-wrap gap-2">
                {CHEAT_TYPES.map((cheat) => (
                  <button
                    key={cheat.id}
                    type="button"
                    onClick={() => toggleCheatType(cheat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      cheatTypes.includes(cheat.id)
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400 border"
                        : "bg-gray-800/50 border-gray-700 text-gray-400 border hover:border-gray-600"
                    }`}
                  >
                    {cheat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suspicion Start - Simple input instead of grid */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-400 mb-3">
                When does the cheating start?
              </label>
              <input
                type="text"
                value={startTick}
                onChange={(e) => setStartTick(e.target.value)}
                placeholder="e.g. Round 15 or Tick 12000"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"
              />
              <p className="text-xs text-gray-600 mt-2">Optional - helps reviewers find the suspicious moments</p>
            </div>

            {/* Suspicion Reason */}
            <div className="bg-[#12121a] border border-gray-800/50 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Why do you think they&apos;re cheating?
              </label>
              <textarea
                value={suspicionReason}
                onChange={(e) => setSuspicionReason(e.target.value)}
                placeholder="Describe suspicious moments, behavior, specific rounds..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white resize-none"
              />
            </div>

            {/* Submit Button - Glowing effect */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !suspicionReason}
              className={`w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-all flex items-center justify-center gap-3 ${
                !submitting && suspicionReason ? "shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50" : ""
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Report
                </>
              )}
            </button>

            {/* Back Button */}
            <button
              onClick={() => goToStep("inspect")}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors"
            >
              ← Back to suspect selection
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
