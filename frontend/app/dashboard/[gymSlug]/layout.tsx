import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fetchBackend } from '@/lib/api-client';
import ThemeToggle from '@/components/dashboard/ThemeToggle';
import {
  Dumbbell,
  LayoutDashboard,
  Users,
  CreditCard,
  CheckSquare,
  Bot,
  MessageCircle,
  Settings,
  LogOut,
  UserCheck,
  FileText,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gymSlug: string }>;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
  const params = await props.params;
  const { children } = props;

  // Retrieve current user and gym details from Express Backend
  const res = await fetchBackend('/api/auth/me');
  if (!res.ok) {
    redirect('/login');
  }

  const { user: activeUser } = await res.json();
  const gym = activeUser.gym;

  // Enforce tenant scoping and access check
  const decodedGymSlug = decodeURIComponent(params.gymSlug).toLowerCase();
  if (!gym || (activeUser.role !== 'SUPERADMIN' && gym.slug.toLowerCase() !== decodedGymSlug)) {
    redirect('/login');
  }

  const sidebarLinks = [
    { label: 'Analytics Home', icon: <LayoutDashboard className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}` },
    { label: 'Members Directory', icon: <Users className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/members` },
    { label: 'Membership Plans', icon: <CreditCard className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/plans` },
    { label: 'Payments Portal', icon: <CheckSquare className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/payments` },
    { label: 'Chatbot Configs', icon: <Bot className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/chatbot` },
    { label: 'Live Human Chat', icon: <MessageCircle className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/live-chat` },
    { label: 'Message Templates', icon: <FileText className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/templates` },
    { label: 'Integrations Setup', icon: <Settings className="h-4 w-4" />, href: `/dashboard/${params.gymSlug}/settings` },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 font-sans text-zinc-100 relative overflow-hidden">
      {/* Background Lights */}
      <div className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-cyan-600/5 blur-[100px]" />
      <div className="absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/5 blur-[100px]" />

      {/* Sidebar Panel */}
      <aside className="hidden w-64 border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md md:flex flex-col z-10">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-2 border-b border-zinc-900 px-6">
          <Dumbbell className="h-6 w-6 text-cyan-400" />
          <span className="text-lg font-black tracking-tight text-white uppercase">
            Fit<span className="text-cyan-400">Flow</span>
          </span>
        </div>

        {/* Gym Tenant Switcher */}
        <div className="px-4 py-3 border-b border-zinc-900/60 bg-zinc-900/10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Tenant</span>
            <span className="block text-sm font-bold text-white mt-0.5 truncate">{gym.name}</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold text-zinc-400 hover:bg-zinc-900/60 hover:text-white transition-all duration-200"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Bottom Profile Details */}
        <div className="border-t border-zinc-900 p-4 bg-zinc-950/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 font-extrabold text-xs">
              {activeUser.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-white truncate">{activeUser.name}</span>
              <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500 mt-0.5 uppercase tracking-wider">
                <UserCheck className="h-2.5 w-2.5 text-cyan-400" /> {activeUser.role}
              </span>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-900/30 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden z-10">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-6 md:px-8 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-zinc-400">Dashboard</span>
            <span className="text-zinc-700">/</span>
            <span className="text-sm font-extrabold text-white">{gym.name}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
              🟢 System Online
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-zinc-950/20">{children}</main>
      </div>
    </div>
  );
}
