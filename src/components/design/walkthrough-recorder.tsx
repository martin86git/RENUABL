"use client";

import clsx from "clsx";
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Download,
  MessageSquare,
  Circle,
  EyeOff,
  Eye,
  Loader2,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MAX_SECONDS,
  NO_STORAGE,
  TEXT_WORDS_MAX,
  walkthroughText,
  RECORDING_NOTE,
  VIDEO_BITS_PER_SECOND,
  cleanCues,
  cuesFor,
  lengthWords,
  toVtt,
  type Cue,
  type Walkthrough,
} from "@/lib/domain/design/walkthrough";
import {
  deleteWalkthrough,
  loadWalkthroughs,
  sendWalkthrough,
  setPresenting,
  showWalkthroughOnProposal,
  tidyCaptions,
  walkthroughVideoUrl,
  textWalkthrough,
} from "@/lib/services/walkthrough";
import { recognitionClass, type Recognition } from "./speech";
import { SolIcon } from "./sol-icon";

/** Whether the face bubble was last on, kept on this device. */
const FACE_KEY = "renuabl.design.walkthrough-face";

/** The recording's clock, in milliseconds. */
const clock = () => performance.now();

type Phase = "ready" | "starting" | "recording" | "review" | "sending" | "sent";

/** The types the browser is asked to record in, the first it can make winning. */
const RECORD_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

/**
 * Record a walkthrough of the design (14 Nov 2026, Martin: Loom-style, narrated, Sol adding the subtitles as you
 * speak; `domain/design/walkthrough.ts`). It records this tab and the microphone; while it records, the quote's costs
 * are put away (`setPresenting`), a small bar shows the clock, Stop, and what Sol is hearing as subtitles; when it
 * stops, Sol tidies the subtitles and the recording can be watched, sent to the customer's proposal, or done again.
 */
export function WalkthroughRecorder({ jobId, customer, onClose }: { jobId: string; customer: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [problem, setProblem] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [hearing, setHearing] = useState("");
  const [tidying, setTidying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<Walkthrough[]>([]);
  const [storage, setStorage] = useState(true);
  // Texting it to the customer once it is saved (14 Nov 2026, Martin): only where texts are on and they have a mobile.
  const [texts, setTexts] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [mobile, setMobile] = useState(false);
  const [kept, setKept] = useState<Walkthrough | null>(null);
  const [words, setWords] = useState("");
  const [texting, setTexting] = useState(false);
  const [texted, setTexted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  // Your face in a corner bubble (14 Nov 2026, Martin): the camera drawn over the page, so the tab's recording carries
  // it. On or off before and during the recording; the choice is kept on this device.
  const [face, setFace] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    try {
      // Read once the page is in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(FACE_KEY) === "1") setFace(true);
    } catch {
      // Storage is off: the bubble starts off.
    }
  }, []);
  const cameraOff = () => {
    for (const t of cameraRef.current?.getTracks() ?? []) t.stop();
    cameraRef.current = null;
    setCamera(null);
  };
  const cameraOn = async () => {
    if (cameraRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      cameraRef.current = stream;
      setCamera(stream);
    } catch {
      setFace(false);
      setProblem("The camera didn't start. Allow it when the browser asks, or record without your face.");
    }
  };
  const toggleFace = (on: boolean) => {
    setFace(on);
    try {
      window.localStorage.setItem(FACE_KEY, on ? "1" : "0");
    } catch {
      // Nothing to do: it still changes for this recording.
    }
  };
  // The camera runs only while the bubble is wanted and there is something to record; never during playback.
  const wantsCamera = face && (phase === "ready" || phase === "starting" || phase === "recording");
  useEffect(() => {
    // The camera is a device outside React: started and stopped as the bubble is wanted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wantsCamera) void cameraOn();
    else cameraOff();
  }, [wantsCamera]);
  useEffect(() => () => cameraOff(), []);
  const bubble = face && camera ? <FaceBubble stream={camera} /> : null;

  const recorder = useRef<MediaRecorder | null>(null);
  const streams = useRef<MediaStream[]>([]);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const heard = useRef<Cue[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const listening = useRef(false);
  const phraseStart = useRef<number | null>(null);
  const tick = useRef<number | null>(null);

  const refresh = () =>
    void loadWalkthroughs(jobId).then((res) => {
      if (!res.ok) return;
      setEarlier(res.walkthroughs);
      setStorage(res.storage);
      setTexts(res.texts);
      setBusinessName(res.business);
      setMobile(res.mobile);
      setPrefix(res.prefix);
    });
  useEffect(refresh, [jobId]);

  const now = () => (clock() - startedAt.current) / 1000;

  // Sol's subtitles as they are spoken: the browser's recognition, a fresh one started whenever it stops itself.
  const hear = () => {
    const Rec = recognitionClass();
    if (!Rec || !listening.current) return;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-AU";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (phraseStart.current === null) phraseStart.current = Math.max(0, now() - 1);
        if (r.isFinal) {
          const made = cuesFor(text, phraseStart.current, Math.max(now(), phraseStart.current + 0.8));
          heard.current = [...heard.current, ...made];
          setCues(heard.current);
          phraseStart.current = null;
        } else interim += text;
      }
      setHearing(interim);
    };
    rec.onend = () => {
      if (listening.current) window.setTimeout(hear, 250);
    };
    rec.onerror = () => undefined;
    recognition.current = rec;
    try {
      rec.start();
    } catch {
      // Already started: the onend above starts a fresh one.
    }
  };

  const stopEverything = () => {
    listening.current = false;
    recognition.current?.stop();
    if (tick.current) window.clearInterval(tick.current);
    tick.current = null;
    for (const s of streams.current) for (const t of s.getTracks()) t.stop();
    streams.current = [];
    setPresenting(false);
  };
  useEffect(() => () => stopEverything(), []);

  const start = async () => {
    setProblem(null);
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setProblem("This browser can't record the screen. Use Chrome or Edge on a computer.");
      return;
    }
    setPhase("starting");
    // The quote's costs go away before anything is captured.
    setPresenting(true);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
      } as DisplayMediaStreamOptions);
      streams.current.push(screen);
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streams.current.push(mic);
      const stream = new MediaStream([...screen.getVideoTracks(), ...mic.getAudioTracks()]);
      const type = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
      chunks.current = [];
      heard.current = [];
      setCues([]);
      setHearing("");
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => void finish(rec.mimeType || type || "video/webm");
      // Stopping the share from the browser's own bar ends the recording too.
      screen.getVideoTracks()[0]?.addEventListener("ended", () => stop());
      recorder.current = rec;
      startedAt.current = clock();
      rec.start(1000);
      listening.current = true;
      hear();
      setSeconds(0);
      tick.current = window.setInterval(() => {
        const s = now();
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
      setPhase("recording");
    } catch {
      stopEverything();
      setPhase("ready");
      setProblem("Recording didn't start. Allow the screen and the microphone when the browser asks.");
    }
  };

  const stop = () => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return;
    // A phrase still being said when it stopped is kept as it was heard.
    if (hearing.trim() && phraseStart.current !== null) heard.current = [...heard.current, ...cuesFor(hearing, phraseStart.current, now())];
    rec.stop();
  };

  const finish = async (type: string) => {
    const length = now();
    stopEverything();
    const blob = new Blob(chunks.current, { type: type.split(";")[0] });
    setVideo(blob);
    setVideoUrl(URL.createObjectURL(blob));
    setSeconds(length);
    const raw = cleanCues(heard.current, length);
    setCues(raw);
    setHearing("");
    setPhase("review");
    if (raw.length) {
      setTidying(true);
      setCues(await tidyCaptions(jobId, raw, length));
      setTidying(false);
    }
  };

  const again = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideo(null);
    setVideoUrl(null);
    setCues([]);
    setPhase("ready");
  };

  const sendText = async () => {
    if (!kept) return;
    setTexting(true);
    setProblem(null);
    const res = await textWalkthrough(jobId, kept.id, words);
    setTexting(false);
    if (!res.ok) return setProblem(res.message);
    setTexted(res.message);
  };
  const copyLink = async () => {
    if (!kept?.link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${kept.link}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("The link couldn't be copied.");
    }
  };

  const send = async () => {
    if (!video || !prefix) return;
    setPhase("sending");
    setProblem(null);
    const res = await sendWalkthrough(jobId, prefix, video, Math.round(seconds), cues, setProgress);
    if (!res.ok) {
      setProblem(res.message);
      setPhase("review");
      return;
    }
    setKept(res.walkthrough);
    setWords(walkthroughText(customer.split(/\s+/)[0] ?? "", businessName));
    setTexted(null);
    setPhase("sent");
    refresh();
  };

  // The subtitles of the recording just made, for the preview's own captions track.
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== "review" && phase !== "sending") return;
    const url = URL.createObjectURL(new Blob([toVtt(cues)], { type: "text/vtt" }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVttUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cues, phase]);

  const close = () => {
    if (phase === "recording") return;
    stopEverything();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "recording") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // While it records: one small bar at the foot of the window (it is in the recording too, so it stays small).
  if (phase === "recording" || phase === "starting")
    return createPortal(
      <div className="theme-studio contents">
        {bubble}
        <div
          data-popup
          className="fixed bottom-4 left-1/2 z-[80] flex max-w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-full bg-primary py-2 pr-2 pl-4 text-white shadow-[0_14px_40px_rgba(11,11,12,0.35)] ring-1 ring-white/10"
        >
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#ef4444] motion-reduce:animate-none" />
            <span className="relative size-2.5 rounded-full bg-[#ef4444]" />
          </span>
          <span className="shrink-0 text-[13px] tabular-nums">{lengthWords(seconds)}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-white/80">
            <SolIcon className="size-3.5 shrink-0 text-sun-line" />
            <span className="truncate">
              {phase === "starting"
                ? "Choose this tab to record…"
                : hearing || cues[cues.length - 1]?.text || "Sol is listening for the subtitles…"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => toggleFace(!face)}
            title={face ? "Hide your face" : "Show your face in a corner bubble"}
            aria-label={face ? "Hide your face" : "Show your face in a corner bubble"}
            aria-pressed={face}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
          >
            {face ? <CameraOff className="size-3.5" aria-hidden /> : <Camera className="size-3.5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={phase !== "recording"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink disabled:bg-white/40"
          >
            <Square className="size-3 fill-current" aria-hidden />
            Stop
          </button>
        </div>
      </div>,
      document.body,
    );

  return createPortal(
    <div className="theme-studio contents">
      {phase === "ready" && bubble}
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4"
        onMouseDown={(e) => e.target === e.currentTarget && close()}
      >
        <div
          role="dialog"
          aria-label="Record a walkthrough"
          data-popup
          className="max-h-[calc(100dvh-2rem)] w-full max-w-[44rem] overflow-y-auto rounded-[24px] bg-surface p-5 shadow-[0_24px_60px_rgba(11,11,12,0.3)] sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-semibold text-ink">
                {phase === "sent" ? "Sent to the proposal" : phase === "ready" ? "Record a walkthrough" : "Your walkthrough"}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {phase === "ready"
                  ? `Talk ${customer} through their design as you go. Sol writes the subtitles as you speak, and it plays at the top of their proposal.`
                  : phase === "sent"
                    ? `It plays at the top of ${customer}'s proposal. Send them the proposal link as usual.`
                    : `${lengthWords(seconds)} · ${tidying ? "Sol is tidying the subtitles…" : `${cues.length} subtitle${cues.length === 1 ? "" : "s"} by Sol`}`}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {phase === "ready" && (
            <>
              <p className="mt-4 rounded-[14px] bg-sun px-4 py-3 text-[13px] text-sun-ink">{RECORDING_NOTE}</p>
              {!storage && (
                <p className="mt-3 text-[13px] text-warning">Recordings can&apos;t be kept here yet: storage for them isn&apos;t set up.</p>
              )}
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-[14px] bg-canvas px-4 py-3">
                <input
                  type="checkbox"
                  checked={face}
                  onChange={(e) => toggleFace(e.target.checked)}
                  className="size-4 accent-[color:var(--sun-line)]"
                />
                <span className="text-[13px] text-ink">
                  Show my face in a corner bubble
                  <span className="block text-[12px] text-muted">
                    {face
                      ? "That's you, bottom left: press it to move it to the other side. Turn it off any time while recording."
                      : "Your camera, in a round over the page, so they see who is talking."}
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => void start()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun-line px-5 py-2.5 text-[14px] font-medium text-white hover:brightness-110"
              >
                <Circle className="size-3.5 fill-current" aria-hidden />
                Start recording
              </button>
              <p className="mt-2 text-[12px] text-muted">
                The browser asks which screen to share: choose this tab. Up to {MAX_SECONDS / 60} minutes.
              </p>
              {earlier.length > 0 && <Earlier jobId={jobId} items={earlier} onChange={refresh} />}
            </>
          )}

          {(phase === "review" || phase === "sending") && videoUrl && (
            <>
              <video src={videoUrl} controls playsInline className="mt-4 w-full rounded-[14px] bg-ink">
                {vttUrl && <track kind="captions" src={vttUrl} srcLang="en" label="Subtitles" default />}
              </video>
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] text-ink-2">Read or change the subtitles</summary>
                <div className="mt-2 max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {cues.length === 0 && <p className="text-[13px] text-muted">Sol didn&apos;t hear anything to subtitle.</p>}
                  {cues.map((c, i) => (
                    <label key={i} className="flex items-start gap-2">
                      <span className="mt-2 w-10 shrink-0 text-[11px] text-muted tabular-nums">{lengthWords(c.start)}</span>
                      <input
                        value={c.text}
                        onChange={(e) => setCues((all) => all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                        className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
                      />
                    </label>
                  ))}
                </div>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={phase === "sending" || tidying || !storage || !prefix}
                  className="inline-flex items-center gap-2 rounded-full bg-sun-line px-5 py-2.5 text-[14px] font-medium text-white hover:brightness-110 disabled:bg-line disabled:text-muted"
                >
                  {phase === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                  {phase === "sending" ? `Saving ${Math.round(progress * 100)}%` : `Save and share with ${customer}`}
                </button>
                {video && videoUrl && (
                  <a
                    href={videoUrl}
                    download={`walkthrough-${customer.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.${video.type.includes("mp4") ? "mp4" : "webm"}`}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={again}
                  disabled={phase === "sending"}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Record again
                </button>
              </div>
              {/* Why Save can't be pressed, said where it is (14 Nov 2026, Martin: it was greyed out with no reason). */}
              {!storage && <p className="mt-3 text-[13px] text-warning">{NO_STORAGE}</p>}
            </>
          )}

          {phase === "sent" && (
            <div className="mt-4 rounded-[16px] bg-canvas p-4">
              <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <MessageSquare className="size-4" aria-hidden />
                Text {customer} the video
              </p>
              {texts && mobile ? (
                <>
                  <textarea
                    value={words}
                    onChange={(e) => setWords(e.target.value.slice(0, TEXT_WORDS_MAX))}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-[12px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
                  />
                  <p className="mt-1 text-[12px] text-muted">The link to the video goes on its own line after your words.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sendText()}
                      disabled={texting || Boolean(texted)}
                      className="inline-flex items-center gap-2 rounded-full bg-sun-line px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:bg-line disabled:text-muted"
                    >
                      {texting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
                      {texted ? "Texted" : "Send the text"}
                    </button>
                    {texted && <span className="text-[13px] text-positive">{texted}</span>}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[13px] text-muted">
                  {!texts
                    ? "Texts aren't switched on for your business yet. Copy the link below and send it yourself."
                    : `There's no mobile on ${customer}'s record. Copy the link below and send it yourself.`}
                </p>
              )}
            </div>
          )}
          {phase === "sent" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1.5 text-[13px] text-positive">
                <Check className="size-3.5" aria-hidden /> On the proposal
              </span>
              {kept?.link && (
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink"
                >
                  <Copy className="size-3.5" aria-hidden /> {copied ? "Copied" : "Copy the link"}
                </button>
              )}
              <button
                type="button"
                onClick={again}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] text-ink-2 ring-1 ring-line hover:text-ink"
              >
                <Video className="size-3.5" aria-hidden /> Record another
              </button>
            </div>
          )}

          {problem && <p className="mt-3 text-[13px] text-danger">{problem}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Your face in a round over the page while recording: the camera, mirrored as a mirror is, bottom left. A press moves
 * it to the other side, out of the way of what you are showing. It is part of the page, so it is in the recording.
 */
function FaceBubble({ stream }: { stream: MediaStream }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [right, setRight] = useState(false);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);
  return (
    <button
      type="button"
      onClick={() => setRight((r) => !r)}
      title="Move it to the other side"
      aria-label="Your camera. Press to move it to the other side"
      className={clsx(
        "fixed bottom-20 z-[85] size-40 overflow-hidden rounded-full bg-ink shadow-[0_14px_40px_rgba(11,11,12,0.35)] ring-4 ring-white transition-[left,right] duration-300 motion-reduce:transition-none",
        right ? "right-4" : "left-4",
      )}
    >
      <video ref={video} autoPlay muted playsInline className="size-full scale-x-[-1] object-cover" />
    </button>
  );
}

/** The deal's earlier recordings: watch, show or hide on the proposal, delete. The newest shown one is what the customer sees. */
function Earlier({ jobId, items, onChange }: { jobId: string; items: Walkthrough[]; onChange: () => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const firstShown = items.find((w) => w.shown)?.id ?? null;
  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="text-[13px] font-medium text-ink">Earlier recordings</p>
      <ul className="mt-2 space-y-2">
        {items.map((w) => (
          <li key={w.id} className="rounded-[14px] bg-canvas px-3 py-2">
            <div className="flex items-center gap-2 text-[13px]">
              <button type="button" onClick={() => setPlaying(playing === w.id ? null : w.id)} className="text-ink hover:underline">
                {new Date(w.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · {lengthWords(w.seconds)}
              </button>
              <span className={clsx("text-[12px]", w.id === firstShown ? "text-positive" : "text-muted")}>
                {w.id === firstShown ? "On the proposal" : w.shown ? "Older" : "Hidden"}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                title={w.shown ? "Hide it from the proposal" : "Show it on the proposal"}
                aria-label={w.shown ? "Hide it from the proposal" : "Show it on the proposal"}
                onClick={() => void showWalkthroughOnProposal(jobId, w.id, !w.shown).then(onChange)}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
              >
                {w.shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              </button>
              <button
                type="button"
                title="Delete this recording"
                aria-label="Delete this recording"
                onClick={() => {
                  if (window.confirm("Delete this recording? It can't be brought back."))
                    void deleteWalkthrough(jobId, w.id).then(onChange);
                }}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-danger"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            {playing === w.id && (
              <video src={walkthroughVideoUrl(jobId, w.id)} controls playsInline className="mt-2 w-full rounded-[10px] bg-ink" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
