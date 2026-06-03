import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  description?: string;
  glowColor?: 'emerald' | 'orange' | 'cyan' | 'violet';
}

export default function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
  glowColor = 'cyan',
}: MetricCardProps) {
  const glowClasses = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:border-emerald-500/40',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400 group-hover:border-orange-500/40',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 group-hover:border-cyan-500/40',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400 group-hover:border-violet-500/40',
  };

  const changeTextClasses = {
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    neutral: 'text-zinc-400',
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-2xl hover:shadow-cyan-950/10">
      {/* Decorative Gradient Background Glow */}
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-all duration-300 opacity-20 group-hover:opacity-30 ${
        glowColor === 'emerald' ? 'bg-emerald-500' :
        glowColor === 'orange' ? 'bg-orange-500' :
        glowColor === 'violet' ? 'bg-violet-500' : 'bg-cyan-500'
      }`} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium tracking-wide text-zinc-400">{title}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ${glowClasses[glowColor]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-white">{value}</span>
        {change && (
          <span className={`text-xs font-semibold ${changeTextClasses[changeType]}`}>
            {change}
          </span>
        )}
      </div>

      {(description || change) && (
        <p className="mt-2 text-xs text-zinc-500 font-medium">
          {description || 'vs. previous month'}
        </p>
      )}
    </div>
  );
}
