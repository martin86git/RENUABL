"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { SIGN_IN_PAGE_WORDS as W } from "@/lib/domain/design/sign-in-page";
import { loadSignInPage, renewSignInPage } from "@/lib/services/design-account";

const card = "rounded-lg bg-surface p-5 shadow-[var(--shadow-soft)] ring-1 ring-line sm:p-6";
const pill = "inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-ink hover:border-forest";

/** Your account: the business's own sign-in address (sign-in-page.ts), to copy and share; the owner can make a new one. */
export function SignInPageSection({ owner }: { owner: boolean }) {
  const [path, setPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    void loadSignInPage().then((p) => !gone && setPath(p));
    return () => {
      gone = true;
    };
  }, []);

  const url = path && typeof window !== "undefined" ? `${window.location.origin}${path}` : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("Couldn't copy. Select the link and copy it instead.");
    }
  };

  const renew = async () => {
    setAsking(false);
    const res = await renewSignInPage();
    if (res.path) setPath(res.path);
    else setProblem(res.problem ?? "That didn't work.");
  };

  return (
    <section className={card} aria-labelledby="sign-in-page">
      <h2 id="sign-in-page" className="text-[19px] tracking-tight text-ink">
        {W.title}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{W.about}</p>
      <p className="mt-3 break-all rounded-md bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink select-all">{url ?? "…"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={pill} onClick={() => void copy()} disabled={!url}>
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? W.copied : W.copy}
        </button>
        {url && (
          <a className={pill} href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" aria-hidden />
            {W.open}
          </a>
        )}
        {owner && !asking && (
          <button type="button" className={pill} onClick={() => setAsking(true)} disabled={!url}>
            <RefreshCw className="size-3.5" aria-hidden />
            {W.renew}
          </button>
        )}
      </div>
      {asking && (
        <div className="mt-3 rounded-md border border-line p-3 text-sm text-ink-2">
          <p>{W.renewAsk}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={pill} onClick={() => void renew()}>
              {W.renewYes}
            </button>
            <button type="button" className="px-2 text-xs text-muted hover:text-ink" onClick={() => setAsking(false)}>
              Keep this one
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{W.logoMissing}</p>
      {problem && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
