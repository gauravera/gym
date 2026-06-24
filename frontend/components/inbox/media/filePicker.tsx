"use client";

import React from "react";

interface Props {
    label: string;
    description: string;
    accept: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onSelect: (files: FileList) => void;
}

export default function FilePicker({
    label,
    description,
    accept,
    inputRef,
    onSelect,
}: Props) {
    return (
        <div className="mt-4 flex flex-col gap-4 items-center">
            <button
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:bg-zinc-800 text-left flex flex-col items-center justify-center gap-1.5 aspect-square max-w-[160px]"
            >
                <div className="text-3xl">📁</div>
                <p className="font-medium text-xs text-white">{label}</p>
            </button>

            <p className="text-xs text-zinc-500 text-center">
                {description}
            </p>

            <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    if (e.target.files?.length) {
                        onSelect(e.target.files);
                        e.target.value = "";
                    }
                }}
            />
        </div>
    );
}
