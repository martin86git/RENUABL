"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PenTool, X } from "lucide-react";
import clsx from "clsx";

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
 * The designer over the page: a centred window with the page's grey either side (8 Nov 2026, Martin: in the same space, so
 * it reads as quick; it was a drawer from the right), the whole screen on a phone. Kept loaded once opened, so closing
 * never loses the work, with a way back at the foot of the page while it holds work not saved.
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
        className={clsx(
          "fixed inset-0 z-[59] bg-ink/30 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onFold}
        aria-hidden
      />
      {/* A centred window, about as wide as it is tall, with the page's grey either side (8 Nov 2026, Martin: in the same
          space, so it reads as quick); the whole screen on a phone. It opens with a short zoom from a touch smaller. */}
      <section
        role="dialog"
        aria-modal={open}
        aria-label="Design"
        aria-hidden={!open}
        className={clsx(
          "fixed inset-0 z-[60] m-auto flex flex-col overflow-hidden bg-canvas transition duration-200 ease-out motion-reduce:transition-none",
          "sm:h-[min(92dvh,62rem)] sm:w-[min(calc(100vw-3rem),calc(min(92dvh,62rem)*1.3))] sm:rounded-[28px] sm:shadow-[0_30px_80px_rgba(11,11,12,0.28)] sm:ring-1 sm:ring-line",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-[0.97] opacity-0",
        )}
      >
        {/* No bar of its own (8 Nov 2026, Martin: the map taller and wider): the close round sits in the corner, beside the
            designer's own slim row, which keeps it clear. */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={onFold}
            className="flex size-9 items-center justify-center rounded-full bg-surface text-ink-2 shadow-sm ring-1 ring-line hover:text-ink"
            aria-label={back}
            title={unsaved ? `${back} (not saved yet)` : back}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {/* A new address in the frame is a new designer: keyed so it loads afresh. */}
        <iframe key={frame} src={frame} title="Design tool" className="min-h-0 w-full flex-1 border-0" />
      </section>
      {/* Closed with work not saved: a way back to it, at the foot of the page. */}
      {!open && unsaved && (
        <button
          type="button"
          onClick={onOpen}
          className="fixed bottom-5 left-1/2 z-[58] inline-flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink shadow-lift"
        >
          <PenTool className="size-4 text-sun-line" aria-hidden /> Back to the design
          <span className="text-xs text-white/70">· not saved yet</span>
        </button>
      )}
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
