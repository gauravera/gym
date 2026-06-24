'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.user.role === 'SUPERADMIN') {
          router.push('/superadmin');
        } else if (data.user.gym) {
          router.push(`/dashboard/${data.user.gym.slug}`);
        } else {
          setError('User profile not associated with a gym tenant.');
        }
      } else {
        setError(data.error || 'Invalid email or password.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 font-sans relative overflow-hidden">
      {/* Background Neon Glowing Orbs */}
      <div className="absolute left-1/4 top-1/4 -h-96 w-96 rounded-full bg-cyan-600/10 blur-[120px]" />
      <div className="absolute right-1/4 bottom-1/4 -h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="w-full max-w-md">
        {/* Logo Brand Header */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-0.5 shadow-xl shadow-cyan-500/10">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-950">
              <Dumbbell className="h-6 w-6 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            FIT<span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">FLOW</span>
          </h1>
          <p className="mt-2 text-xs text-zinc-500 font-medium">WhatsApp-First Gym Membership Management SaaS</p>
        </div>

        {/* Card Body */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-xl relative">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Welcome Back</h2>
            <p className="text-xs text-zinc-400 mt-1">Sign in to manage your members and chatbot settings.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gym.com"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-3 pl-10 pr-10 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-300 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-950 text-cyan-500 focus:ring-cyan-500/20 h-4 w-4 accent-cyan-500 cursor-pointer"
                />
                Remember me (30 days)
              </label>
            </div>

            {/* Signin Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
            >
              {isLoading ? 'Signing you in...' : (
                <>
                  Enter Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Help */}
          <div className="mt-8 border-t border-zinc-800/80 pt-6 text-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Demo Sandbox Setup</span>
            <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">
              New to the platform? You can register a brand new Gym and Owner account instantly via Register tab!
            </p>
            <div className="mt-3 flex justify-center gap-4 text-xs font-semibold text-cyan-400">
              <a href="/register" className="hover:underline">Register New Gym Tenant & Owner</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
