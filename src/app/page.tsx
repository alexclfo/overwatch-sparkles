"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Upload, LogOut, Crosshair, Target, Shield, Lock, Eye } from "lucide-react";

interface Stats {
  submissions: number;
  cheatersFound: number;
  reviewed: number;
}

// Animated counter hook - fast animation
function useAnimatedCounter(target: number, duration: number = 800) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === 0) return;
    
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      
      // Ease-out cubic for snappy feel
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    startTime.current = null;
    frameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return count;
}

export default function Home() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "sparkles" || session?.user?.role === "moderator";
  const [stats, setStats] = useState<Stats>({ submissions: 0, cheatersFound: 0, reviewed: 0 });

  // Animated counters
  const animatedSubmissions = useAnimatedCounter(stats.submissions);
  const animatedReviewed = useAnimatedCounter(stats.reviewed);
  const animatedCheaters = useAnimatedCounter(stats.cheatersFound);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#08080c] relative overflow-hidden">
      {/* Background - tactical map grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Primary grid - dark gray lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Secondary grid - finer lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:10px_10px]" />
        {/* Vignette effect - radial gradient for edge darkening */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_70%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* Nav */}
      <nav className="relative z-50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Crosshair className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white">SPARKLES</span>
                <span className="text-lg font-light text-gray-400 ml-1">OVERWATCH</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status === "loading" ? (
                <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
              ) : session ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-all"
                    >
                      <Lock className="w-4 h-4" />
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                    {session.user?.image && (
                      <img
                        src={session.user.image}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-sm text-gray-300">{session.user?.name}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="p-2 text-gray-500 hover:text-white transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <a
                  href="/api/auth/steam"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-4.6 0-8.45-3.08-9.64-7.27l3.83 1.58a2.84 2.84 0 0 0 2.78 2.27c1.56 0 2.83-1.27 2.83-2.83v-.13l3.4-2.43h.08c2.08 0 3.77-1.69 3.77-3.77s-1.69-3.77-3.77-3.77-3.77 1.69-3.77 3.77v.05l-2.37 3.46-.16-.01c-.55 0-1.08.16-1.53.45L2 10.08A10 10 0 0 1 12 2m5.23 10.58c0-1.34 1.09-2.43 2.43-2.43s2.43 1.09 2.43 2.43-1.09 2.43-2.43 2.43-2.43-1.09-2.43-2.43m-9.85 3.39c0 1.01.82 1.83 1.83 1.83s1.83-.82 1.83-1.83-.82-1.83-1.83-1.83-1.83.82-1.83 1.83z"/>
                  </svg>
                  Sign in with Steam
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-gray-400 text-sm font-medium mb-8">
              <Shield className="w-4 h-4" />
              Evidence Submission Grid
            </div>
            <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tight">
              <span className="bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent">COMMUNITY</span>
              <br />
              <span className="bg-gradient-to-b from-[#FF5500] to-[#cc4400] bg-clip-text text-transparent">
                OVERWATCH
              </span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed font-mono">
              The official evidence submission grid for Sparkles. Direct secure upload pipeline.
            </p>
          </div>

          {/* Stats Bar - Terminal style with animated counters */}
          <div className="flex flex-wrap justify-center gap-6 mb-16">
            <div className="font-mono text-sm text-orange-400/80 tracking-wider">
              [ SUBMISSIONS: <span className="text-orange-400 font-bold tabular-nums">{animatedSubmissions.toLocaleString()}</span> ]
            </div>
            <div className="font-mono text-sm text-green-400/80 tracking-wider">
              [ REVIEWED: <span className="text-green-400 font-bold tabular-nums">{animatedReviewed.toLocaleString()}</span> ]
            </div>
            <div className="font-mono text-sm text-red-400/80 tracking-wider">
              [ CHEATERS_FOUND: <span className="text-red-400 font-bold tabular-nums">{animatedCheaters.toLocaleString()}</span> ]
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4 mb-24">
            {session ? (
              <Link
                href="/submit"
                className="group flex items-center gap-3 px-8 py-4 bg-[#FF5500] hover:bg-[#ff6620] text-white font-bold rounded-lg text-lg transition-all border-2 border-[#ff7744] shadow-[0_4px_0_0_#cc4400,0_6px_20px_rgba(255,85,0,0.3)] hover:shadow-[0_4px_0_0_#cc4400,0_6px_30px_rgba(255,85,0,0.5)] active:shadow-[0_2px_0_0_#cc4400] active:translate-y-[2px]"
              >
                <Upload className="w-5 h-5" />
                SUBMIT DEMO
                <span className="text-orange-200 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            ) : (
              <a
                href="/api/auth/steam"
                className="group flex items-center gap-3 px-8 py-4 bg-[#FF5500] hover:bg-[#ff6620] text-white font-bold rounded-lg text-lg transition-all border-2 border-[#ff7744] shadow-[0_4px_0_0_#cc4400,0_6px_20px_rgba(255,85,0,0.3)] hover:shadow-[0_4px_0_0_#cc4400,0_6px_30px_rgba(255,85,0,0.5)] active:shadow-[0_2px_0_0_#cc4400] active:translate-y-[2px]"
              >
                SIGN IN TO SUBMIT
                <span className="text-orange-200 group-hover:translate-x-1 transition-transform">→</span>
              </a>
            )}
            <a
              href="https://youtube.com/@Sparkles"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Watch on YouTube
            </a>
          </div>

          {/* Features - Glassmorphism cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="group p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-orange-500/50 hover:scale-[1.02] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Direct Upload</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                No more broken Google Drive links. Upload .dem files directly, up to 500MB.
              </p>
            </div>

            <div className="group p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-cyan-500/50 hover:scale-[1.02] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Auto-Detection</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Demo parser extracts map and players automatically. Just pick the suspect.
              </p>
            </div>

            <div className="group p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-purple-500/50 hover:scale-[1.02] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Eye className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Sparkles Review</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your submissions get reviewed by Sparkles. Cheater or legit? Get the verdict.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600 text-sm">
            Community project for Sparkles Overwatch. Not affiliated with Valve or Faceit.
          </p>
        </div>
      </footer>
    </div>
  );
}
