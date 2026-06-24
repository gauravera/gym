"use client";

import { motion } from "framer-motion";
import { Smile, Paperclip, Mic, Send } from "lucide-react";
import type { Message, Conversation } from "@/lib/types";

interface Props {
  conversation: Conversation;
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: () => void;
  onToggleAttach: () => void;
  onSendTemplate: () => void;
  isSessionActive: boolean;
}

export default function ChatFooter({
  conversation,
  inputValue,
  setInputValue,
  inputRef,
  replyTo,
  onCancelReply,
  onSend,
  onToggleAttach,
  onSendTemplate,
  isSessionActive,
}: Props) {
  if (conversation.isBlocked) {
    return (
      <div className="relative z-10 flex-shrink-0 bg-zinc-900/30 border-t border-zinc-900 px-4 py-4 text-center text-xs sm:text-sm text-zinc-500 font-medium flex items-center justify-center gap-2 select-none">
        <span>This contact is blocked. Unblock them to resume conversation.</span>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex-shrink-0 bg-zinc-950 border-t border-zinc-900">
      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="px-4 py-2 bg-zinc-900/50 border-l-4 border-cyan-600 flex items-center justify-between text-white">
          <div className="text-xs min-w-0">
            <div className="font-medium">
              {replyTo.sender === "executive"
                ? "You"
                : conversation.companyName}
            </div>
            <div className="truncate max-w-xs text-zinc-400">
              {replyTo.text || "Media message"}
            </div>
          </div>

          <button
            onClick={onCancelReply}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* INPUT ROW */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2">
          {/* LEFT ICONS */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-900"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onToggleAttach}
              className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-900"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
            </motion.button>
          </div>

          {/* TEXT INPUT */}
          <div className="flex-1 bg-zinc-900 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5">
            <input
              ref={inputRef}
              type="text"
              disabled={!isSessionActive}
              placeholder={
                isSessionActive ? "Type a message" : "Template message required"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  isSessionActive
                ) {
                  e.preventDefault();
                  onSend();
                }
              }}
              className="bg-transparent text-sm outline-none w-full placeholder:text-zinc-650 text-white"
            />
          </div>

          {/* RIGHT ACTION */}
          {!isSessionActive ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onSendTemplate}
              className="bg-cyan-600 hover:bg-cyan-500 transition-colors text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">Send Template</span>
              <span className="sm:hidden">Template</span>
            </motion.button>
          ) : inputValue.trim() ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onSend}
              className="bg-cyan-600 hover:bg-cyan-500 transition-colors text-white p-2 sm:p-2.5 rounded-full"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-900"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
