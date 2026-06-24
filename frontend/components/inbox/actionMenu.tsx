"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@/lib/types";

interface ActionMenuState {
    message: Message;
    rect: DOMRect;
}

interface Props {
    actionMenu: ActionMenuState | null;
    onClose: () => void;
    onReply: (message: Message) => void;
    onCopy: (message: Message) => void;
    onDelete?: (message: Message) => void;
}

export default function ActionMenu({
    actionMenu,
    onClose,
    onReply,
    onCopy,
    onDelete,
}: Props) {
    if (!actionMenu) return null;

    const { rect, message } = actionMenu;

    const menuHeight = 160;
    const menuWidth = 192;

    const isNearBottom = rect.bottom + menuHeight > window.innerHeight;

    const top = isNearBottom
        ? rect.top - menuHeight - 8
        : rect.bottom + 8;

    const isIncoming = message.sender === "customer";

    const left = isIncoming
        ? Math.min(window.innerWidth - menuWidth - 12, rect.left)
        : Math.max(12, rect.right - menuWidth);

    return (
        <AnimatePresence>
            <>
                {/* Click outside */}
                <div
                    className="fixed inset-0 z-40"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-50 w-48 bg-zinc-900 text-white border border-zinc-800 rounded-xl shadow-lg overflow-hidden"
                    style={{ top, left }}
                >
                    <ActionButton
                        label="Reply"
                        onClick={() => {
                            onReply(message);
                            onClose();
                        }}
                    />

                    <ActionButton
                        label="Copy"
                        onClick={() => {
                            onCopy(message);
                            onClose();
                        }}
                    />

                    <ActionButton
                        label="Delete for me"
                        destructive
                        onClick={() => {
                            if (onDelete) onDelete(message);
                            onClose();
                        }}
                    />
                </motion.div>
            </>
        </AnimatePresence>
    );
}

/* ------------------ */
/* Internal Component */
/* ------------------ */

function ActionButton({
    label,
    onClick,
    disabled,
    destructive,
}: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    destructive?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 text-sm transition-colors
        ${destructive ? "text-red-500 hover:bg-red-500/10" : "text-zinc-200 hover:bg-zinc-800"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
        >
            {label}
        </button>
    );
}
