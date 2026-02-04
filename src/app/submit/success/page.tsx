"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shield, CheckCircle, Home, Upload } from "lucide-react";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("id");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Submission Received!</h1>
        <p className="text-gray-400 mb-2">
          Your demo has been uploaded and is now in the review queue.
        </p>
        {submissionId && (
          <p className="text-sm text-gray-500 mb-8">
            Submission ID: <code className="text-gray-400">{submissionId.slice(0, 8)}...</code>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back Home
          </Link>
          <Link
            href="/submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Submit Another
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-orange-500" />
              <span className="font-semibold">Sparkles Overwatch</span>
            </Link>
          </div>
        </div>
      </nav>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
