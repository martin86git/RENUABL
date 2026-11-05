"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, PenTool, X } from "lucide-react";
import clsx from "clsx";
import { ui } from "./design-shell";

/**
 * The design tool slides over the page as a drawer, never a new screen (5 Nov 2026, Martin: the intention is not to
 * stay in the designer for long, especially once it designs itself). Every link to the designer anywhere in the frame
 * opens it here; inside the drawer the designer is the real page in a frame, shown bare (`embed=1`).
 */
const DESIGNER = "/design/roof";
const OPEN_EVENT = "renuabl:open-design";

/** True inside the drawer's frame. */
export const inDrawer = () => typeof window !== "undefined" && window.parent !== window;

/** The designer's address with the frame's mark on it. */
function embedded(href: string): string {
  const u = new URL(href, window.location.origin);
  u.searchParams.set("embed", "1");
  return u.pathname + u.search;
}

const isDesigner = (href: string) => {
  try {
    const u = new URL(href, window.location.origin);
    return u.origin === window.location.origin && u.pathname === DESIGNER;
  } catch {
    return false;
  }
};

/**
 * Opens a designer address: inside the drawer it stays there (the shell is bare in a frame); elsewhere the drawer slides
 * over the page (or, with no drawer to hear it, the page goes there as before).
 */
export function openDesigner(href: string, router: { push: (href: string) => void }, otherwise?: () => void) {
  if (inDrawer()) return otherwise ? otherwise() : router.push(href);
  const ask = new CustomEvent<{ href: string; heard: boolean }>(OPEN_EVENT, { detail: { href, heard: false } });
  window.dispatchEvent(ask);
  if (!ask.detail.heard) {
    if (otherwise) otherwise();
    else router.push(href);
  }
}

/** The drawer is told by the designer inside it (same site only). */
type News = { saved?: boolean; unsaved?: boolean; fold?: boolean; go?: string };
function tell(news: News) {
  if (inDrawer()) window.parent.postMessage({ renuablDesign: news }, window.location.origin);
}

/** A plain left click on a link, the kind the drawer takes over (not a new tab, not a download). */
function plainLink(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  return a;
}

/**
 * The drawer itself: it covers the page but for a strip on the left, slides out of sight when folded and back with its
 * tab, and stays as it was while folded (kept loaded once opened, so folding never loses the work).
 */
export function DesignDrawer(props: {
  src: string;
  open: boolean;
  onOpen: () => void;
  onFold: () => void;
  onSaved?: () => void;
  /** Somewhere else in the product was asked for from inside the designer. */
  onGo?: (href: string) => void;
  /** The tab's words while the drawer is out ("Back to the deal"). */
  back?: string;
}) {
  const { src, open, onOpen, onFold, onSaved, onGo, back = "Back" } = props;
  const [loaded, setLoaded] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const heard = useRef({ onSaved, onFold, onGo });
  useEffect(() => {
    heard.current = { onSaved, onFold, onGo };
  }, [onSaved, onFold, onGo]);
  useEffect(() => {
    // Opening it is what loads it; from then on it stays.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setLoaded(true);
  }, [open]);
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const news = (e.data as { renuablDesign?: News } | null)?.renuablDesign;
      if (!news) return;
      if (news.fold) heard.current.onFold();
      if (typeof news.go === "string" && news.go.startsWith("/")) {
        heard.current.onFold();
        heard.current.onGo?.(news.go);
      }
      if (typeof news.unsaved === "boolean") setUnsaved(news.unsaved);
      if (news.saved) {
        setUnsaved(false);
        heard.current.onSaved?.();
      }
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, []);
  useEffect(() => {
    if (!open) return;
    // The page under it doesn't scroll while the design is out; Escape folds it away.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onFold();
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", key);
    };
  }, [open, onFold]);
  useEffect(() => {
    if (!unsaved) return;
    const stay = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [unsaved]);

  if (!loaded) return null;
  const frame = embedded(src);
  return (
    <>
      <div
        className={clsx("fixed inset-0 z-[59] bg-ink/25 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onFold}
        aria-hidden
      />
      <section
        aria-label="Design"
        aria-hidden={!open}
        className={clsx(
          "fixed inset-y-0 left-12 right-0 z-[60] flex flex-col bg-canvas shadow-[-12px_0_40px_rgba(0,0,0,0.18)] transition-transform duration-300 sm:left-16",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* The tab on the drawer's edge: folds it away, and when folded stays at the window's edge to bring it back. */}
        <button
          type="button"
          onClick={open ? onFold : onOpen}
          className="absolute right-full top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-lg border border-r-0 border-line bg-surface px-1.5 py-3 text-[12px] font-medium text-ink shadow-[-4px_0_12px_rgba(0,0,0,0.08)] hover:bg-surface-2"
          aria-label={open ? "Fold the design away" : "Bring the design back"}
        >
          <PenTool className="size-4" aria-hidden />
          <span className="[writing-mode:vertical-rl]">{open ? back : "Design"}</span>
          {unsaved && <span className="size-2 rounded-full bg-sun-line" title="Not saved yet" />}
        </button>
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
          <p className="text-sm font-medium text-ink">
            Design {unsaved && <span className="ml-2 text-xs font-normal text-sun-ink">Not saved yet</span>}
          </p>
          <div className="flex items-center gap-1">
            <a href={src} target="_blank" rel="noreferrer" className={clsx(ui.quiet, "h-8 text-xs")}>
              <ExternalLink className="size-3.5" aria-hidden /> Own tab
            </a>
            <button type="button" onClick={onFold} className={clsx(ui.quiet, "h-8 text-xs")} aria-label="Fold the design away">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        {/* A new address in the frame is a new designer: keyed so it loads afresh. */}
        <iframe key={frame} src={frame} title="Design tool" className="min-h-0 w-full flex-1 border-0" />
      </section>
    </>
  );
}

/**
 * The frame's drawer (in `DesignShell`): any link to the designer, and `openDesigner`, slide it over the page. On the
 * design tool's own page its home link goes on as a page, so the home stays where it is.
 */
export function ShellDesignDrawer() {
  const router = useRouter();
  const path = usePathname();
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const unsaved = useRef(false);
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const hearUnsaved = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const news = (e.data as { renuablDesign?: News } | null)?.renuablDesign;
      if (news && typeof news.unsaved === "boolean") unsaved.current = news.unsaved;
      if (news?.saved) unsaved.current = false;
    };
    const show = (href: string) => {
      const u = new URL(href, window.location.origin);
      u.searchParams.delete("embed");
      const next = u.pathname + u.search;
      const was = shown.current;
      if (was && was !== next) {
        if (unsaved.current && !window.confirm("The design open has changes that aren't saved. Open this one and lose them?"))
          return setOpen(true);
        unsaved.current = false;
      }
      shown.current = next;
      setSrc(next);
      setOpen(true);
    };
    const asked = (e: Event) => {
      const detail = (e as CustomEvent<{ href: string; heard: boolean }>).detail;
      detail.heard = true;
      show(detail.href);
    };
    const click = (e: MouseEvent) => {
      const a = plainLink(e);
      if (!a || !isDesigner(a.href)) return;
      // The design home's own page keeps its home link as a page.
      const u = new URL(a.href);
      if (window.location.pathname === DESIGNER && !u.search) return;
      e.preventDefault();
      show(a.href);
    };
    window.addEventListener("message", hearUnsaved);
    window.addEventListener(OPEN_EVENT, asked);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("message", hearUnsaved);
      window.removeEventListener(OPEN_EVENT, asked);
      document.removeEventListener("click", click, true);
    };
  }, []);
  // A new page folds the drawer away.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [path]);
  if (!src) return null;
  const job = new URL(src, "http://x").searchParams.get("job");
  return (
    <DesignDrawer
      src={src}
      open={open}
      onOpen={() => setOpen(true)}
      onFold={() => setOpen(false)}
      // The customer's name and other links in the designer: that page, under the drawer.
      onGo={(href) => router.push(href)}
      // What the page underneath shows of the design (a deal's system, the design home's lists) is read again.
      onSaved={() => router.refresh()}
      back={job ? "Back" : "Close"}
    />
  );
}

/**
 * Inside the drawer's frame (the bare shell): links to the designer stay in the frame; links anywhere else in the
 * product fold the drawer and go there on the page underneath (a Link whose click is already taken goes nowhere).
 */
export function DrawerFrameLinks() {
  useEffect(() => {
    if (!inDrawer()) return;
    const click = (e: MouseEvent) => {
      const a = plainLink(e);
      if (!a) return;
      const u = new URL(a.href);
      if (u.origin !== window.location.origin || u.pathname === DESIGNER) return;
      e.preventDefault();
      tell({ go: u.pathname + u.search + u.hash });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}

/** Whether this page is inside the drawer's frame, without upsetting the server's render. */
export function useInDrawer(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => window.parent !== window,
    () => false,
  );
}

/** From inside the drawer: show this page underneath, the drawer folded. */
export const goUnderneath = (href: string) => tell({ go: href });
