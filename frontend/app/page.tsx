import React from 'react';
import Link from 'next/link';
import { Dumbbell, Bot, QrCode, CreditCard, Bell, Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 relative overflow-hidden flex flex-col justify-between">
      {/* Background glowing gradients */}
      <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-600/5 blur-[120px]" />
      <div className="absolute right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/5 blur-[120px]" />

      {/* Top Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 px-6 py-4 md:px-12 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-6 w-6 text-cyan-400" />
          <span className="text-lg font-black tracking-tight text-white uppercase">
            Fit<span className="text-cyan-400">Flow</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs font-bold text-zinc-400 hover:text-white transition-all">
            Sign In
          </Link>
          <Link href="/register" className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-600/20 transition-all">
            Register Gym
          </Link>
        </div>
      </header>

      {/* Main Hero & Features */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 md:py-24 flex flex-col items-center text-center space-y-16 z-10">
        {/* Title Badge & Catchy Hero */}
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3.5 py-1 text-[10px] font-bold text-cyan-400 border border-cyan-500/25 uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> WhatsApp-First Membership SaaS
          </div>
          
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl leading-[1.1] font-sans">
            The Gym Membership SaaS Built for <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">WhatsApp</span>
          </h1>

          <p className="max-w-xl mx-auto text-sm text-zinc-500 leading-relaxed font-medium">
            Empower your members to check status, view plans, renew subscriptions, and pay instantly inside WhatsApp. Gym owners manage everything from a dashboard.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-cyan-500/15 hover:brightness-110 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
            >
              Get Started (Register Gym) <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-3.5 text-sm font-bold text-zinc-300 hover:bg-zinc-800 transition-all w-full sm:w-auto"
            >
              Demo Staff Login
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 w-full pt-8">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 text-left space-y-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Chatbot Automation</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Numerical menu flows automatically handle membership checks, plans listings, and subscriptions.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 text-left space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Smart Payments</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Out of the box dynamic UPI QR codes and automatic webhook integrations for Razorpay gateways.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 text-left space-y-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Renewal Engine</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Automated daily checks dispatch customizable expiring/expired alerts on WhatsApp.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 text-left space-y-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Human Takeover</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Pause chatbot triggers instantly per member, letting staff respond in live-chat overlays.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-6 text-center text-xs text-zinc-600 z-10">
        © 2026 FitFlow SaaS. Enterprise-level multi-tenant membership operations. All rights reserved.
      </footer>
    </div>
  );
}
