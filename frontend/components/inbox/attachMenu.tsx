"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (type: "template" | "image" | "video" | "audio" | "document") => void;
}

export default function AttachMenu({ open, onClose, onSelect }: Props) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Click outside */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="
                          absolute bottom-20 left-4 z-50
                          w-48
                          rounded-2xl
                          shadow-2xl
                          py-2
                          bg-zinc-900
                          border border-zinc-800
                        "
                    >
                        <AttachItem
                            icon="📝"
                            label="Template"
                            color="#8b5cf6"
                            onClick={() => onSelect("template")}
                        />

                        <AttachItem
                            icon="🖼️"
                            label="Photos"
                            color="#22c55e"
                            onClick={() => onSelect("image")}
                        />

                        <AttachItem
                            icon="📷"
                            label="Videos"
                            color="#ef4444"
                            onClick={() => onSelect("video")}
                        />

                        <AttachItem
                            icon="🎧"
                            label="Audio"
                            color="#f97316"
                            onClick={() => onSelect("audio")}
                        />

                        <AttachItem
                            icon="📄"
                            label="Document"
                            color="#3b82f6"
                            onClick={() => onSelect("document")}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/* ------------------ */
/* Internal component */
/* ------------------ */

function AttachItem({
    icon,
    label,
    color,
    onClick,
}: {
    icon: string;
    label: string;
    color: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="
              w-full flex items-center gap-4
              px-4 py-2.5
              text-sm
              text-zinc-100
              hover:bg-zinc-850/50
              transition-all
              cursor-pointer
            "
        >
            <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: color }}
            >
                <span className="text-md">{icon}</span>
            </div>

            <span className="font-normal">{label}</span>
        </button>
    );
}
