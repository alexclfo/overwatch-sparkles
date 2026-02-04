"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Upload, LogOut, Crosshair, DollarSign, Target, Shield } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "sparkles" || session?.user?.role === "moderator";

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background - tactical grid/scanline effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[size:100%_4px] opacity-20" />
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
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white border border-orange-500/50 hover:border-orange-500 hover:bg-orange-500/10 rounded-lg transition-all"
                    >
                      <Shield className="w-4 h-4" />
                      Access Dashboard
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
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z"/>
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
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-gray-400 text-sm font-medium mb-8">
              <Shield className="w-4 h-4" />
              Evidence Submission Platform
            </div>
            <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tight">
              <span className="text-white">COMMUNITY</span>
              <br />
              <span className="text-orange-500">
                OVERWATCH
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
              The official evidence submission platform. Direct uploads, inventory tracking, and automated analysis.
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24">
            {session ? (
              <Link
                href="/submit"
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
              >
                <Upload className="w-5 h-5" />
                Submit Demo
                <span className="text-orange-200 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            ) : (
              <a
                href="/api/auth/steam"
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
              >
                Sign in to Submit
                <span className="text-orange-200 group-hover:translate-x-1 transition-transform">→</span>
              </a>
            )}
            <a
              href="https://youtube.com/@Sparkles"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-4 text-gray-400 hover:text-white transition-colors"
            >
              Watch on YouTube
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
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

            <div className="group p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-orange-500/50 hover:scale-[1.02] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Auto-Detection</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Demo parser extracts map and players automatically. Just pick the suspect.
              </p>
            </div>

            <div className="group p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:border-green-500/50 hover:scale-[1.02] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Inventory Value</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                See exactly how much they stand to lose. Nothing hits harder than a VAC on a $10k account.
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
