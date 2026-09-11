import Link from "next/link";
import { getCustomerByConnectToken } from "@/lib/customer-profile";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function CustomerConnectPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { status } = await searchParams;
  const customer = await getCustomerByConnectToken(token);

  if (!customer) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 text-2xl font-bold">
            ⚠️
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Invalid Connect Link</h1>
          <p className="text-sm text-slate-400 mb-6">
            This candidate onboarding link is invalid or has expired. Please contact your Superadmin or team lead for a new activation link.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-all"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const isConnected = status === "connected" || (customer.status === "active" && !!customer.encryptedRefreshToken);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
            ✨ Candidate Autopilot Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Fetch<span className="text-indigo-400">mail</span> Outreach Engine
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Automated Job Radar & AI-Powered Cold Email Application Dispatcher
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/40">
          {isConnected ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-5 text-3xl shadow-lg shadow-emerald-500/10 animate-bounce">
                🚀
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Autopilot Active & Linked
              </span>
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome Aboard, {customer.name}!
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Your Gmail account (<span className="text-indigo-400 font-semibold">{customer.email}</span>) is now connected with Fetchmail.
              </p>

              {/* Schedule Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-6">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                    🌙 2:00 AM Daily
                  </div>
                  <div className="text-sm font-semibold text-white">Job Scraping & Filtering</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Scrapes and MX-verifies newly posted {customer.role} jobs.
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    ☀️ 9:00 AM Daily
                  </div>
                  <div className="text-sm font-semibold text-white">AI Pitch & Application Send</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sends up to {customer.dailyLimit || 20} personalized applications with your resume.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/sent-emails"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  View Sent Applications Dashboard →
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold">
                  {customer.name?.slice(0, 1).toUpperCase() || "C"}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{customer.name}</h2>
                  <p className="text-xs text-slate-400">{customer.email}</p>
                </div>
                <span className="ml-auto px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                  Pending Authorization
                </span>
              </div>

              {/* Profile Blueprint */}
              <div className="space-y-3 mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Your Configured Outreach Profile
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Target Role:</span>
                    <span className="text-white font-semibold">{customer.role}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Experience Level:</span>
                    <span className="text-white font-semibold">{customer.experience}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Target Location:</span>
                    <span className="text-white font-semibold">{customer.location || "Remote"}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block mb-0.5">Resume Attachment:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      📄 {customer.resumeName || "Attached in System"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanatory Box */}
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 mb-6 leading-relaxed">
                <span className="font-bold text-white block mb-1">🔐 Why do I need to connect once?</span>
                Google requires your explicit 1-time permission so that Fetchmail can dispatch job application emails directly from your email address (<span className="text-white font-medium">{customer.email}</span>) without you needing to do manual copy-pasting every morning.
              </div>

              {/* Action Button */}
              <a
                href={`/api/auth/google?token=${customer.connectToken}`}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm text-center transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 group"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Connect Gmail & Activate Autopilot
              </a>

              <p className="text-[11px] text-slate-500 text-center mt-3">
                Official Google OAuth 2.0 Security • Stored offline refresh token is encrypted • Revoke anytime in Google Account settings
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
