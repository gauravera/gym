"use client";

import { useEffect } from "react";
import api from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import type { Message } from "@/lib/types";

const STATUS_PRIORITY: Record<NonNullable<Message["status"]>, number> = {
  failed: 0,
  sent: 1,
  delivered: 2,
  received: 2,
  read: 3,
};

interface UseChatSocketParams {
  conversationId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onUpdateConversationStatus?: (
    conversationId: string,
    status: Message["status"],
  ) => void;
  onCustomerMessage?: () => void;
  onBlockedStatusChange?: (isBlocked: boolean) => void;
}

export function useChatSocket({
  conversationId,
  setMessages,
  onUpdateConversationStatus,
  onCustomerMessage,
  onBlockedStatusChange,
}: UseChatSocketParams) {
  useEffect(() => {
    if (!conversationId) return;

    connectSocket();
    const socket = getSocket();

    socket.emit("join-conversation", conversationId);

    /* =========================
       NEW MESSAGE HANDLER
    ========================== */
    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });

      if (msg.sender === "customer") {
        onCustomerMessage?.();
      }
    };

    /* =========================
       STATUS UPDATE HANDLER
    ========================== */
    const handleStatusUpdate = ({
      whatsappMessageId,
      status,
    }: {
      whatsappMessageId: string;
      status?: Message["status"];
    }) => {
      if (!status) return;

      setMessages((prev) => {
        let updated = prev.map((m) => {
          if (m.whatsappMessageId !== whatsappMessageId) return m;

          if (!m.status) return { ...m, status };

          if (STATUS_PRIORITY[m.status] >= STATUS_PRIORITY[status]) {
            return m; // ⛔ ignore downgrade
          }

          return { ...m, status };
        });

        const lastMessage = updated[updated.length - 1];
        if (
          lastMessage?.whatsappMessageId === whatsappMessageId &&
          onUpdateConversationStatus
        ) {
          onUpdateConversationStatus(conversationId, status);
        }

        return updated;
      });
    };

    /* =========================
       DELETED MESSAGE HANDLER
    ========================== */
    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    /* =========================
       BLOCKED STATUS HANDLER
    ========================== */
    const handleBlockedStatus = ({ isBlocked }: { isBlocked: boolean }) => {
      onBlockedStatusChange?.(isBlocked);
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:status", handleStatusUpdate);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("conversation:blocked_status", handleBlockedStatus);

    return () => {
      socket.emit("leave-conversation", conversationId);
      socket.off("message:new", handleNewMessage);
      socket.off("message:status", handleStatusUpdate);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("conversation:blocked_status", handleBlockedStatus);
    };
  }, [
    conversationId,
    setMessages,
    onUpdateConversationStatus,
    onCustomerMessage,
    onBlockedStatusChange,
  ]);
}
