"use client";

import Link from "next/link";
import { FileText, ArrowLeft, Shield } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-300 relative">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-gradient-to-b from-violet-500/5 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-gradient-to-t from-cyan-500/5 to-transparent rounded-full blur-[120px]" />
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
          <div className="p-3.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-2xl">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Terms of Service
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Last Updated: June 3, 2026 • FitApp Platform
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl p-8 backdrop-blur-md text-xs leading-relaxed text-zinc-400">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              1. Acceptance of Terms
            </h2>
            <p>
              By registering an account and using the FitApp (FitFlow SaaS) dashboard, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you must refrain from using our services immediately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              2. Account Registration & Meta Integrations
            </h2>
            <p>
              To access integration features (specifically automated alerts and member communication logs via the WhatsApp Business API), you must link your Meta Developer App and WABA credentials.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>You are responsible for maintaining the confidentiality of your API tokens and login credentials.</li>
              <li>You agree to provide accurate, current, and complete registration details to the platform.</li>
              <li>All activities that occur under your linked WhatsApp configurations are your sole responsibility.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              3. Meta & WhatsApp Messaging Policy Compliance
            </h2>
            <p>
              FitApp acts as an integration gateway utilizing official Meta Cloud APIs. When sending automated alerts, updates, or running chatbot assistants, you explicitly agree:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
              <li>To comply fully with the <strong>WhatsApp Business Messaging Policy</strong> and <strong>Meta Developer Terms</strong>.</li>
              <li>Not to send unsolicited promotional spam, deceptive messages, or violate local telecommunication marketing regulations.</li>
              <li>To ensure members have explicitly opted in to receive automated alerts from your business.</li>
            </ul>
            <p className="text-[11px] text-amber-400 flex items-start gap-1.5 mt-2 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Warning: Violations of Meta Developer Policies may result in the immediate and permanent suspension of your Facebook App access, WABA ID, and FitApp subscription.</span>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              4. Fees, Billing, & Renewals
            </h2>
            <p>
              We offer subscription packages for access to our SaaS platform. Fees are billed on a recurring monthly or annual basis. 
            </p>
            <p>
              Please note that WhatsApp Cloud API usage charges (template or utility session costs set by Meta) are billed directly to your Meta Business Payment Account and are separate from FitApp subscription charges.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              5. Limitation of Liability
            </h2>
            <p>
              FitApp is provided "as is" without warranty of any kind. Under no circumstances shall FitApp be liable for any indirect, incidental, special, or consequential damages arising from the downtime of external APIs, Meta developer console modifications, or temporary service interruptions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              6. Termination & Deauthorization
            </h2>
            <p>
              You may terminate these terms at any time by deleting your account and deauthorizing the FitApp integration inside your Facebook Settings panel. We reserve the right to suspend accounts that engage in malicious API exploits or platform terms violations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-white tracking-wide">
              7. Governing Law & Contact
            </h2>
            <p>
              These Terms of Service shall be governed by and construed in accordance with the laws governing digital services. For questions regarding terms, billing, or general operations, contact:
            </p>
            <p className="font-mono text-zinc-300">
              Email: info.kamatvishal@gmail.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-[10px] text-zinc-650 border-t border-zinc-900 pt-6">
          © {new Date().getFullYear()} FitApp (FitFlow SaaS). All rights reserved. Compliant with Meta Developer Agreements.
        </div>
      </div>
    </div>
  );
}
