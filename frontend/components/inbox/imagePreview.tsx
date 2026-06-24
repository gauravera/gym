"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

interface ImagePreviewState {
    files: File[];
    urls: string[];
    caption: string;
}

interface Props {
    preview: ImagePreviewState | null;
    sending: boolean;
    onClose: () => void;
    onChangeCaption: (v: string) => void;
    onSend: () => void;
}

export default function ImagePreview({
    preview,
    sending,
    onClose,
    onChangeCaption,
    onSend,
}: Props) {
    return (
        <AnimatePresence>
            {preview && (
                <>
                    {/* BACKDROP */}
                    <motion.div
                        className="absolute inset-0 z-40 bg-black/90"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* PREVIEW CONTAINER */}
                    <motion.div
                        className="absolute inset-0 z-50 flex flex-col bg-black text-white"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 30, opacity: 0 }}
                    >
                        {/* HEADER */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <button
                                disabled={sending}
                                onClick={onClose}
                                className={sending ? "opacity-40 cursor-not-allowed" : ""}
                            >
                                ✕
                            </button>
                            <span className="text-sm">
                                {preview.files.length} photo
                                {preview.files.length > 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* MAIN IMAGE */}
                        <div className="flex-1 overflow-y-auto flex items-center justify-center px-4">
                            <img
                                src={preview.urls[0]}
                                className="max-w-full max-h-[65vh] object-contain rounded-lg"
                            />
                        </div>

                        {/* THUMBNAILS */}
                        {preview.urls.length > 1 && (
                            <div className="flex gap-2 px-4 py-2 overflow-x-auto">
                                {preview.urls.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        className="w-16 h-16 rounded object-cover"
                                    />
                                ))}
                            </div>
                        )}

                        {/* CAPTION + SEND */}
                        <div className="flex items-center gap-3 p-4 border-t border-white/10">
                            <input
                                placeholder="Add a caption…"
                                value={preview.caption}
                                onChange={(e) => onChangeCaption(e.target.value)}
                                className="flex-1 bg-white/10 px-4 py-2 rounded-full outline-none text-sm text-white"
                            />

                            <button
                                disabled={sending}
                                onClick={onSend}
                                className="bg-cyan-600 w-12 h-12 rounded-full flex items-center justify-center hover:bg-cyan-500 transition-colors"
                            >
                                <Send className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* LOADING OVERLAY */}
                        {sending && (
                            <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center gap-4">
                                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-sm text-white/90 tracking-wide">
                                    Sending…
                                </span>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
