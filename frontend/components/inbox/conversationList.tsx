"use client";

import { Search, MoreVertical, MessageCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getConversationTick } from "@/utils/getConversationTicks";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { Conversation } from "@/lib/types";
import { toast } from "react-toastify";

export default function ConversationList({
  conversations,
  selected,
  onSelect,
  onReload,
}: {
  conversations: Conversation[];
  selected: string;
  onSelect: (id: string) => void;
  onReload?: () => Promise<void>;
}) {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [searchQuery, setSearchQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [whatsappCheckResult, setWhatsappCheckResult] = useState<{
    isOnWhatsApp: boolean;
    phoneNumber: string;
    conversationExists: boolean;
    conversationId?: string;
    lead?: {
      id: string;
      phoneNumber: string;
      companyName: string;
    };
  } | null>(null);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.toLowerCase();
    return (
      conv.companyName?.toLowerCase().includes(query) ||
      conv.phone?.toLowerCase().includes(query)
    );
  });

  // Check if search query looks like a phone number
  const isPhoneNumber = (query: string) => {
    const digitsOnly = query.replace(/\D/g, "");
    return digitsOnly.length >= 10;
  };

  // Debounce WhatsApp number check
  useEffect(() => {
    if (!searchQuery || !isPhoneNumber(searchQuery)) {
      setWhatsappCheckResult(null);
      return;
    }

    // Don't check if we already have a conversation with this number
    const existingConv = conversations.find(
      (conv) =>
        conv.phone?.replace(/\D/g, "") === searchQuery.replace(/\D/g, ""),
    );
    if (existingConv) {
      setWhatsappCheckResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`/api/dashboard/${gymSlug}/inbox/check-number`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: searchQuery }),
        });
        if (res.ok) {
          const result = await res.json();
          setWhatsappCheckResult(result);
        } else {
          setWhatsappCheckResult(null);
        }
      } catch (error) {
        console.error("Error checking WhatsApp number:", error);
        setWhatsappCheckResult(null);
      } finally {
        setIsChecking(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery, conversations, gymSlug]);

  // Handle creating a new conversation
  const handleStartChat = async () => {
    if (!whatsappCheckResult || isCreating) return;

    setIsCreating(true);
    try {
      if (whatsappCheckResult.conversationExists) {
        onSelect(whatsappCheckResult.conversationId!);
        setSearchQuery("");
        setWhatsappCheckResult(null);
      } else {
        const res = await fetch(`/api/dashboard/${gymSlug}/inbox/create-conversation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: whatsappCheckResult.phoneNumber,
            companyName: whatsappCheckResult.lead?.companyName || whatsappCheckResult.phoneNumber,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (onReload) {
            await onReload();
          }
          onSelect(result.conversationId);
          setSearchQuery("");
          setWhatsappCheckResult(null);
          toast.success("Conversation started successfully!");
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to start conversation.");
        }
      }
    } catch (error: any) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start conversation. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-96 xl:w-[420px] bg-zinc-950 border-r border-zinc-900 flex flex-col h-full">
      <div className="bg-zinc-950 p-4 flex items-center justify-between border-b border-zinc-900">
        <h2 className="text-xl font-bold text-white">Chats</h2>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden bg-zinc-950/20">
        {/* Search Bar */}
        <div className="flex-none px-3 py-2 bg-zinc-950 border-b border-zinc-900">
          <div className="flex items-center gap-3 bg-zinc-900 rounded-lg px-4 py-2">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs outline-none w-full text-white placeholder:text-zinc-600 focus:outline-none"
            />
            {isChecking && (
              <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {whatsappCheckResult &&
            whatsappCheckResult.isOnWhatsApp &&
            filteredConversations.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 border-b border-zinc-900 bg-zinc-900/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {whatsappCheckResult.lead?.companyName ||
                        whatsappCheckResult.phoneNumber}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {whatsappCheckResult.phoneNumber}
                    </p>
                  </div>
                  <button
                    onClick={handleStartChat}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        Chat
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full px-4 py-3 flex cursor-pointer items-start justify-between border-b border-zinc-900/60 transition-colors hover:bg-zinc-900/20 ${
                selected === conv.id ? "bg-zinc-900/40 border-l-4 border-cyan-500" : ""
              }`}
            >
              <div className="flex items-start gap-3 w-full overflow-hidden">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center text-white font-semibold text-lg">
                    {conv.companyName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1 pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white truncate">
                      {conv.companyName}
                    </p>
                    <span className="text-[9px] text-zinc-500 whitespace-nowrap">
                      {conv.lastActivity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {getConversationTick(
                        conv.lastMessageDirection,
                        conv.lastMessageStatus,
                      )}
                      <p
                        className={`text-[10px] truncate ${
                          conv.hasUnread
                            ? "text-white font-semibold"
                            : "text-zinc-400"
                        }`}
                      >
                        {conv.lastMessage}
                      </p>
                    </div>

                    {conv.unreadCount! > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-black text-zinc-950 shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {searchQuery &&
            filteredConversations.length === 0 &&
            !whatsappCheckResult &&
            !isChecking && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-500">
                  No conversations found
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
