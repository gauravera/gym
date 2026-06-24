"use client";

import { Clock, AlertCircle } from "lucide-react";

export default function SessionBanner({
  isSessionActive,
  remainingTime,
}: {
  isSessionActive: boolean;
  remainingTime: string | null;
}) {
  return (
    <div className="flex-shrink-0 z-30">
      {isSessionActive && remainingTime ? (
        <div className="bg-yellow-500 dark:bg-yellow-500/40 border-b border-yellow-500 dark:border-yellow-500 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black shrink-0" />
          <span className="text-[10px] sm:text-xs text-black font-medium">
            24-hour window expires in {remainingTime}
          </span>
        </div>
      ) : (
        <div className="bg-red-500 dark:bg-red-500/40 border-b border-red-500 dark:border-red-500 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
          <span className="text-[10px] sm:text-xs text-white">
            24-hour window closed. Send a template to restart.
          </span>
        </div>
      )}
    </div>
  );
}
