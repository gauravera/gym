import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  ChevronDown,
  UserX,
  UserCheck,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { toast } from "react-toastify";

export default function ChatHeader({
  conversation,
  onBack,
  onUpdateLeadStatus,
  onToggleBlock,
}: {
  conversation: Conversation;
  onBack?: () => void;
  onUpdateLeadStatus?: (leadId: string, status: string) => Promise<void>;
  onToggleBlock?: () => void;
}) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusRef.current &&
        !statusRef.current.contains(event.target as Node)
      ) {
        setIsStatusOpen(false);
      }
    }
    if (isStatusOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStatusOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    contacted:
      "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    qualified:
      "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    converted:
      "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    lost: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    converted: "Converted",
    lost: "Lost",
  };

  const currentStatus = conversation.status || "new";

  return (
    <div className="relative z-20 bg-zinc-900 px-4 py-3.5 flex items-center justify-between border-b border-zinc-800 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5 text-zinc-100" />
          </button>
        )}

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500/70 flex items-center justify-center text-white font-extrabold flex-shrink-0 shadow-sm">
          {conversation.memberName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-zinc-100 truncate">
              {conversation.memberName}
            </h3>
            {conversation.isBlocked && (
              <span className="bg-rose-500/15 text-rose-400 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-rose-500/20 flex-shrink-0 animate-pulse">
                Blocked
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 truncate">
            {conversation.phone}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Lead Status Dropdown */}
        {conversation.leadId && onUpdateLeadStatus && (
          <div className="relative block" ref={statusRef}>
            <button
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${statusColors[currentStatus] || "bg-zinc-950 text-zinc-300 border-zinc-800"}`}
            >
              <div className={`w-2 h-2 rounded-full bg-current opacity-70`} />
              {statusLabels[currentStatus] || currentStatus}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {isStatusOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl py-1.5 z-[100] overflow-hidden">
                {Object.entries(statusLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === currentStatus) {
                        setIsStatusOpen(false);
                        return;
                      }

                      setIsStatusOpen(false);

                      toast.info(
                        <div className="flex flex-col gap-3 text-white">
                          <p className="font-medium">
                            Change lead status to "{label}"?
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                toast.dismiss();
                              }}
                              className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                onUpdateLeadStatus(conversation.leadId!, key);
                                toast.dismiss();
                                toast.success(`Status updated to ${label}`);
                              }}
                              className="px-3 py-1.5 text-sm bg-cyan-600 text-white hover:bg-cyan-500 rounded-md transition-colors"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>,
                        {
                          autoClose: false,
                          closeButton: false,
                          position: "top-center",
                        },
                      );
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-900 transition-colors flex items-center gap-3 cursor-pointer ${key === currentStatus ? "bg-zinc-900 font-bold" : "text-zinc-300"}`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-zinc-500"
                    />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <motion.button className="hidden sm:flex p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer">
          <Video className="w-5 h-5" />
        </motion.button>
        <motion.button className="hidden sm:flex p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer">
          <Phone className="w-5 h-5" />
        </motion.button>
        
        {onToggleBlock && (
          <div className="relative" ref={menuRef}>
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-xl hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer flex items-center justify-center"
            >
              <MoreVertical className="w-5 h-5" />
            </motion.button>

            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl py-1.5 z-[100] overflow-hidden">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleBlock();
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer ${
                    conversation.isBlocked
                      ? "text-green-400"
                      : "text-rose-500"
                  }`}
                >
                  {conversation.isBlocked ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Unblock Contact</span>
                    </>
                  ) : (
                    <>
                      <UserX className="w-4 h-4" />
                      <span>Block Contact</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
