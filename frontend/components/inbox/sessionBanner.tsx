"use client";

import { Clock, AlertCircle } from "lucide-react";

export default function SessionBanner({
  isSessionActive,
  remainingTime,
}: {
  isSessionActive: boolean;
  remainingTime: string | null;
}) {
  if (!isSessionActive) {
    return (
      <div className="flex-shrink-0 z-30">
        <div className="bg-red-500/10 border-b border-red-500/20 backdrop-blur-md px-4 py-2.5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
          <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
            24-hour window closed. Send a template to restart.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 z-30">
      <div className="bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md px-4 py-2.5 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
          {remainingTime
            ? `24-hour window expires in ${remainingTime}`
            : "24-hour window is active"}
        </span>
      </div>
    </div>
  );
}
