"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Trash2, CheckCircle } from "lucide-react";

function PrivacyContent() {
  const searchParams = useSearchParams();
  const deleteStatus = searchParams.get("status");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-300 relative">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-gradient-to-b from-cyan-500/5 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-gradient-to-t from-violet-500/5 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16 relative z-10">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Last Updated: June 3, 2026 • FitApp Platform
            </p>
          </div>
        </div>

        {/* Automated Deletion Status Banner */}
        {deleteStatus && (
          <div className="mb-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur-md">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-emerald-400">
                  Data Deletion Request Initiated
                </h3>
                <p className="text-xs text-zinc-455 leading-relaxed">
                  We have successfully received your Facebook data deletion request from the Meta Platform.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1 text-[10px] font-mono text-zinc-400 border border-zinc-800">
                  <span>Ticket ID:</span>
                  <span className="font-bold text-cyan-400">{deleteStatus}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  All temporary user tokens and associated Meta profile metadata are scheduled for permanent purge. This process completes automatically within 24 hours.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-8 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl p-8 backdrop-blur-md text-xs leading-relaxed text-zinc-400">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              1. Overview & Information We Collect
            </h2>
            <p>
              At FitApp, we are committed to protecting your privacy. When you utilize our platform to connect your Meta Business accounts and set up the WhatsApp Business API, we process configuration credentials necessary to route automated membership alerts, payment reminders, and chatbot workflows.
            </p>
            <p className="font-semibold text-zinc-300">
              The data elements we collect and manage include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Meta App Scoped User IDs and Access Tokens (stored encrypted).</li>
              <li>WhatsApp Business Account ID (WABA ID) and Phone Number ID.</li>
              <li>WhatsApp messaging templates and status logs to enable chat delivery.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              2. How We Use Your Data
            </h2>
            <p>
              We process your data exclusively to deliver gym notification systems and chatbot features. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>To register and authenticate your business profile with the Meta Cloud API.</li>
              <li>To deliver automated messages (e.g., membership updates) to gym members.</li>
              <li>To sync message statuses (Sent, Delivered, Read) for your analytics dashboard.</li>
            </ul>
            <p>
              We do not sell, trade, or rent your personal profile information to third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              3. Data Protection & Encryption
            </h2>
            <p>
              Security is at the heart of our software architecture. All permanent access tokens received from Meta are encrypted at rest using advanced cryptographic algorithms before being saved to our database. Communications with the Meta API and WhatsApp servers occur exclusively over secured HTTPS channels.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              4. User Rights & Data Deletion (Meta GDPR Compliance)
            </h2>
            <p>
              As a user, you have full control over the data shared with FitApp. You may disconnect your WhatsApp and Meta configurations at any time directly through the integration settings panel on your dashboard.
            </p>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-5 space-y-3 mt-3">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Meta Data Deletion Instructions
              </p>
              <p className="text-zinc-500">
                To trigger an automated deletion of data associated with your Facebook Login:
              </p>
              <ol className="list-decimal list-inside space-y-2 pl-1 text-zinc-400">
                <li>Go to your Facebook Profile's "Settings & Privacy" &gt; "Settings".</li>
                <li>Navigate to "Apps and Websites" and locate <strong>FitApp</strong>.</li>
                <li>Click the "Remove" button next to the app.</li>
                <li>Alternatively, you can submit a manual deletion request by sending an email with your App Scoped ID to <a href="mailto:info.kamatvishal@gmail.com" className="text-cyan-400 hover:underline">info.kamatvishal@gmail.com</a>. We will process your deletion request and issue a ticket within 24 hours.</li>
              </ol>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              5. Contact Us
            </h2>
            <p>
              For any questions regarding this Privacy Policy, user rights, or data deletion queries, feel free to contact our Data Protection representative:
            </p>
            <p className="font-mono text-zinc-300">
              Email: info.kamatvishal@gmail.com<br />
              Developer/Support: FitApp Team
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-[10px] text-zinc-650 border-t border-zinc-900 pt-6">
          © {new Date().getFullYear()} FitApp (FitFlow SaaS). All rights reserved. Compliant with Meta Platform policies.
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs text-zinc-500">
          Loading privacy documentation...
        </div>
      }
    >
      <PrivacyContent />
    </Suspense>
  );
}
