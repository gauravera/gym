"use client";

import { motion } from "framer-motion";
import {
  MoreVertical,
  Check,
  CheckCheck,
  AlertCircle,
  ShoppingBag,
  SquareArrowOutUpRight,
  Phone,
  Reply,
} from "lucide-react";
import type { Message, Conversation } from "@/lib/types";
import { useState, useRef } from "react";

interface Props {
  message: Message;
  conversation: Conversation;
  allMessages: Message[];
  onOpenMenu: (message: Message, rect: DOMRect) => void;
  onReply: (message: Message) => void;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// Audio Player Component
function AudioPlayer({ mediaUrl }: { mediaUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const remainingTime = duration - currentTime;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 min-w-62.5">
      <button
        onClick={togglePlay}
        className="shrink-0 w-10 h-10 rounded-full bg-cyan-600/10 hover:bg-cyan-600/20 flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-cyan-400"
          >
            <rect x="4" y="3" width="3" height="10" />
            <rect x="9" y="3" width="3" height="10" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-cyan-400 ml-0.5"
          >
            <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
          </svg>
        )}
      </button>

      <div className="flex-1 flex items-center gap-2">
        <div
          className="flex-1 h-8 flex items-center gap-0.5 cursor-pointer"
          onClick={handleSeek}
        >
          {[3, 5, 4, 6, 3, 7, 4, 5, 3, 6, 4, 5, 3, 4, 6, 3, 5, 4].map(
            (height, i) => {
              const barPercentage = ((i + 1) / 18) * 100;
              const isFilled = barPercentage <= progressPercentage;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all ${
                    isFilled
                      ? "bg-cyan-600"
                      : "bg-cyan-600/30 hover:bg-cyan-600/40"
                  }`}
                  style={{ height: `${height * 3}px`, minWidth: "2px" }}
                />
              );
            },
          )}
        </div>

        <audio
          ref={audioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            setDuration(audio.duration);
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            setCurrentTime(audio.currentTime);
          }}
        />
      </div>

      <span className="text-xs text-zinc-400 shrink-0">
        {formatTime(remainingTime)}
      </span>
    </div>
  );
}

export default function MessageBubble({
  message: msg,
  conversation,
  allMessages,
  onOpenMenu,
  onReply,
}: Props) {
  const repliedMessage: Message | undefined =
    allMessages.find((m) => m.whatsappMessageId === msg.replyToMessageId) ??
    (msg.replyTo
      ? ({
          ...msg.replyTo,
          id: msg.replyToMessageId || "unknown",
          whatsappMessageId: msg.replyToMessageId,
          timestamp: "",
        } as Message)
      : undefined);

  const cleanText =
    (msg.text || "")
      .replace(/^\[(image|video|audio|document)(?:\s+message)?\]\s*/i, "")
      .trim() ||
    (msg.caption || "").trim() ||
    (msg.template?.body?.text || "").trim();

  const outboundMedia =
    msg.outboundPayload?.image ||
    msg.outboundPayload?.video ||
    msg.outboundPayload?.audio ||
    msg.outboundPayload?.document;

  const effectiveMediaUrl =
    msg.mediaUrl || outboundMedia?.link || outboundMedia?.url;
  const effectiveCaption = msg.caption || outboundMedia?.caption;
  let effectiveMimeType = msg.mimeType;

  if (!effectiveMimeType && outboundMedia) {
    if (msg.outboundPayload?.image) effectiveMimeType = "image/jpeg";
    else if (msg.outboundPayload?.video) effectiveMimeType = "video/mp4";
    else if (msg.outboundPayload?.audio) effectiveMimeType = "audio/mpeg";
    else if (msg.outboundPayload?.document)
      effectiveMimeType = "application/pdf";
  }

  const isImage = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("image/") &&
    msg.template?.header?.type !== "IMAGE"
  );
  const isVideo = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("video/") &&
    msg.template?.header?.type !== "VIDEO"
  );
  const isAudio = !!(
    effectiveMediaUrl && effectiveMimeType?.startsWith("audio/")
  );
  const isDocument = !!(
    effectiveMediaUrl &&
    (effectiveMimeType?.startsWith("application/") ||
      effectiveMimeType?.includes("document")) &&
    msg.template?.header?.type !== "DOCUMENT"
  );

  const formattedTime = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toLowerCase()
    : "";

  const getMessageStatusIcon = (status?: Message["status"]) => {
    if (!status) return null;
    if (status === "sent") return <Check className="w-4 h-4 text-zinc-400" />;
    if (status === "delivered") return <CheckCheck className="w-4 h-4 text-zinc-400" />;
    if (status === "read")
      return <CheckCheck className="w-4 h-4 text-cyan-400" />;
    if (status === "failed")
      return <AlertCircle className="w-4 h-4 text-rose-500" />;
    return null;
  };

  const renderTimestamp = ({
    isOverlay = false,
    customClass = "",
  }: {
    isOverlay?: boolean;
    customClass?: string;
  } = {}) => (
    <div className={`flex items-center gap-0.5 select-none ${customClass}`}>
      <span
        className={`text-[10px] lowercase leading-none ${
          isOverlay
            ? "text-white drop-shadow-sm font-medium"
            : "text-zinc-500"
        }`}
      >
        {formattedTime}
      </span>
      {msg.sender === "executive" && (
        <span
          className={
            msg.status === "read"
              ? "text-cyan-400"
              : isOverlay
                ? "text-white drop-shadow-sm"
                : "text-zinc-500"
          }
        >
          {getMessageStatusIcon(msg.status)}
        </span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-2 ${
        msg.sender === "executive" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex flex-col gap-1
        ${
          isImage || isVideo
            ? "w-fit"
            : msg.template?.header?.type === "IMAGE" ||
                msg.template?.header?.type === "VIDEO"
              ? "w-fit max-w-70"
              : "max-w-[70%]"
        }
        ${
          msg.outboundPayload?.interactive || msg.template?.buttons
            ? "min-w-[200px]"
            : isImage || isVideo
              ? ""
              : "min-w-[120px]"
        }
        `}
      >
        <div
          className={`group relative shadow-none overflow-hidden flex flex-col p-0
          ${
            msg.sender === "executive"
              ? "bg-cyan-900/90 text-white rounded-tr-none rounded-2xl rounded-br-2xl"
              : "bg-zinc-900 text-zinc-100 rounded-tl-none rounded-2xl rounded-bl-2xl border border-zinc-850"
          }
          max-w-full`}
        >
          {/* TEMPLATE HEADER (Rich Media) */}
          {msg.template?.header && (
            <div className="relative">
              {msg.template.header.type === "IMAGE" &&
                msg.template.header.mediaUrl && (
                  <div className="relative">
                    <img
                      src={msg.template.header.mediaUrl}
                      alt="Header"
                      className="w-full h-auto object-cover"
                    />
                    {!cleanText &&
                      renderTimestamp({
                        isOverlay: true,
                        customClass:
                          "absolute bottom-1.5 right-2 bg-black/20 rounded px-1 py-0.5 backdrop-blur-[2px]",
                      })}
                  </div>
                )}

              {msg.template.header.type === "VIDEO" &&
                msg.template.header.mediaUrl && (
                  <video
                    src={msg.template.header.mediaUrl}
                    controls
                    className="w-full h-45 object-cover"
                  />
                )}
              {msg.template.header.type === "DOCUMENT" &&
                msg.template.header.mediaUrl && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-800 border-b border-zinc-700">
                    <div className="p-2 bg-rose-500/10 rounded text-rose-500">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <a
                      href={msg.template.header.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium underline truncate text-zinc-200"
                    >
                      View Document
                    </a>
                  </div>
                )}
              {msg.template.header.type === "TEXT" &&
                msg.template.header.text && (
                  <div className="px-3 pt-3 pb-1 font-bold text-sm text-white">
                    {msg.template.header.text}
                  </div>
                )}
            </div>
          )}

          <div
            className={`flex flex-col ${!isImage && !isVideo ? "px-1.5 py-2 gap-1.5" : ""}`}
          >
            {/* IMAGE MESSAGE */}
            {isImage && effectiveMediaUrl && (
              <div className="w-fit max-w-75">
                <div className="p-1">
                  <img
                    src={effectiveMediaUrl}
                    alt="Image"
                    className={`w-full h-auto object-cover cursor-pointer ${cleanText ? "rounded-t-md" : "rounded-md"}`}
                    onClick={() => window.open(effectiveMediaUrl!, "_blank")}
                  />
                </div>

                {cleanText && (
                  <div className="relative px-2 pb-2">
                    <p
                      className="text-[13px] break-words whitespace-pre-wrap leading-[18px] pr-14"
                    >
                      {cleanText}
                    </p>
                    {!msg.template?.footer && (
                      <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                        {renderTimestamp()}
                      </div>
                    )}
                  </div>
                )}

                {!cleanText && (
                  <div className="absolute bottom-2 right-2">
                    {renderTimestamp({ isOverlay: true })}
                  </div>
                )}
              </div>
            )}

            {/* VIDEO MESSAGE */}
            {isVideo && effectiveMediaUrl && (
              <div className="w-fit max-w-75">
                <div className="p-1">
                  <video
                    src={effectiveMediaUrl}
                    controls
                    className={`w-full h-auto object-cover ${cleanText ? "rounded-t-md" : "rounded-md"}`}
                  />
                </div>

                {cleanText && (
                  <div className="relative px-2 pb-2">
                    <p
                      className="text-[13px] break-words whitespace-pre-wrap leading-[18px] pr-14"
                    >
                      {cleanText}
                    </p>
                    {!msg.template?.footer && (
                      <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                        {renderTimestamp()}
                      </div>
                    )}
                  </div>
                )}

                {!cleanText && (
                  <div className="absolute bottom-8 right-2">
                    {renderTimestamp({ isOverlay: true })}
                  </div>
                )}
              </div>
            )}

            {isAudio && effectiveMediaUrl && (
              <div className="relative p-1">
                <AudioPlayer mediaUrl={effectiveMediaUrl} />
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {isDocument && effectiveMediaUrl && (
              <div className="relative flex items-center gap-3 px-3 py-3 bg-zinc-850 rounded-lg pb-5 m-1">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-cyan-600/10 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-cyan-400"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-zinc-100">
                    {effectiveCaption || "Document"}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {effectiveMimeType?.split("/")[1]?.toUpperCase() || "FILE"} • Tap to view
                  </p>
                </div>
                <a
                  href={effectiveMediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 w-10 h-10 rounded-full bg-cyan-600/10 hover:bg-cyan-600/20 flex items-center justify-center transition-colors text-cyan-400"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {/* REPLY MESSAGE */}
            {msg.replyToMessageId && repliedMessage && (
              <div
                className="mx-1 px-3 py-2 bg-zinc-950/60 border-l-4 border-cyan-500 rounded flex gap-2 cursor-pointer"
                onClick={() => {
                  if (repliedMessage.id && repliedMessage.timestamp) {
                    onReply?.(repliedMessage);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-cyan-400 mb-1">
                    {repliedMessage.sender === "executive"
                      ? "You"
                      : conversation.companyName}
                  </div>
                  <div className="text-xs text-zinc-400 line-clamp-2">
                    {repliedMessage.text ||
                      repliedMessage.caption ||
                      "Media Message"}
                  </div>
                </div>
              </div>
            )}

            {/* TEXT CONTENT */}
            {cleanText && !isImage && !isVideo && (
              <div className="px-2 py-0.5 text-sm break-words whitespace-pre-wrap text-zinc-100">
                {cleanText}
                {!msg.template?.footer && (
                  <span className="float-right ml-2 mt-1 -mb-1">
                    {renderTimestamp()}
                  </span>
                )}
              </div>
            )}

            {/* TEMPLATE FOOTER */}
            {msg.template?.footer && (
              <div className="relative px-2 pb-2">
                <div className="text-xs text-zinc-400 italic opacity-85 pr-14 pb-1">
                  {msg.template.footer}
                </div>
                <div className="absolute bottom-0 right-1.5 flex items-center gap-1">
                  {renderTimestamp()}
                </div>
              </div>
            )}
          </div>

          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenMenu(msg, rect);
              }}
              className="p-1 rounded-full bg-zinc-800 shadow hover:bg-zinc-700"
            >
              <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* TEMPLATE BUTTONS */}
        {msg.template?.buttons && msg.template.buttons.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            <div
              className={`flex gap-1.5 w-full ${
                msg.template.buttons.length === 2 ? "flex-row" : "flex-col"
              }`}
            >
              {msg.template.buttons.map((btn, idx) => (
                <button
                  key={idx}
                  className={`flex-1 w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] border border-zinc-850 bg-zinc-900`}
                  onClick={() => {
                    if (btn.type === "URL" && btn.value) {
                      window.open(btn.value, "_blank");
                    }
                  }}
                >
                  {btn.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
