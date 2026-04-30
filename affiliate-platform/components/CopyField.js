"use client";

import { useState } from "react";

export default function CopyField({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="copy-wrap">
      <input value={value} readOnly />
      <button type="button" className="btn" onClick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
