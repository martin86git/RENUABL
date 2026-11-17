"use client";

/**
 * A new lead's own page (domain/design/first-contact.ts), in the business's name: their home from above with the first
 * design drawn on it, "Is this your home?" as one tap, and the conversation with the business (Sol answering when the
 * business has him on). The chat is the job's own, so it carries on into their proposal later.
 */
import { useEffect, useState } from "react";
import { HELLO_WORDS, type HelloView, type HomeAnswer } from "@/lib/domain/design/first-contact";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { answerHome, helloRoofUrl, loadHello } from "@/lib/services/hello";
import { ChatDock, ChatGreeting, useCustomerChat } from "./chat-panel";

export function HelloPage({ token, view: first }: { token: string; view: HelloView }) {
  const [view, setView] = useState(first);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chat = useCustomerChat({ token, business: view.business.name, phone: view.business.phone, place: "hello" });
  // Told once the page is in a browser, so a link preview doesn't count as the lead having opened it.
  useEffect(() => void loadHello(token, true), [token]);

  const home = async (answer: HomeAnswer) => {
    setBusy(true);
    const res = await answerHome(token, answer);
    setBusy(false);
    if (res.ok) {
      setView(res.view);
      setProblem(null);
    } else setProblem(res.message);
  };

  return (
    <div className="theme-studio min-h-dvh bg-canvas text-ink">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-8 pb-4 sm:pt-12">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{view.business.name}</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[34px]">
          {HELLO_WORDS.title(view.customer.firstName)}
        </h1>

        <ChatGreeting chat={chat} />

        {view.hasRoof && <Roof token={token} view={view} />}
        <p className="-mt-2 text-[14.5px] leading-relaxed text-ink-2">
          {view.system ? HELLO_WORDS.designed : HELLO_WORDS.notDesigned} {HELLO_WORDS.noPrice}
        </p>

        <section aria-label={HELLO_WORDS.homeAsk} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          {view.home ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px]">{view.home === "yes" ? HELLO_WORDS.thanksYes : HELLO_WORDS.thanksNo}</p>
              <button
                type="button"
                disabled={busy}
                className="tap-area text-[13px] text-muted underline-offset-4 hover:underline"
                onClick={() => void home(view.home === "yes" ? "no" : "yes")}
              >
                {view.home === "yes" ? "Actually, it isn't" : "Actually, it is"}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-[17px] font-semibold">{HELLO_WORDS.homeAsk}</h2>
              {view.customer.address && <p className="mt-1 text-[14px] text-muted">{view.customer.address}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void home("yes")}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-ink hover:brightness-125 disabled:bg-surface-2 disabled:text-muted"
                >
                  {HELLO_WORDS.homeYes}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void home("no")}
                  className="inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium ring-1 ring-line hover:bg-surface-2"
                >
                  {HELLO_WORDS.homeNo}
                </button>
              </div>
            </>
          )}
          {problem && (
            <p role="alert" className="mt-3 text-[13px] text-negative">
              {problem}
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[17px] font-semibold">Questions?</h2>
          <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{HELLO_WORDS.chatIntro(view.business.name)}</p>
          <button
            type="button"
            onClick={() => chat.show(true)}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-ink hover:brightness-125"
          >
            Ask a question
          </button>
        </section>

        <ChatDock chat={chat} />
      </main>
    </div>
  );
}

/** The home from above: cropped to the design with its panels drawn, else the whole picture with the home marked. */
function Roof({ token, view }: { token: string; view: HelloView }) {
  const [failed, setFailed] = useState(false);
  const box = view.drawing?.viewBox ?? `0 0 ${ROOF_IMAGE.width} ${ROOF_IMAGE.height}`;
  const [, , w, h] = box.split(" ").map(Number);
  return (
    <figure className="overflow-hidden rounded-2xl bg-[#1f2937] ring-1 ring-line">
      <svg
        viewBox={box}
        className="block h-auto w-full"
        style={{ aspectRatio: `${w} / ${h}`, maxHeight: "60vh" }}
        role="img"
        aria-label="Your home from above"
      >
        {!failed && (
          <image
            href={helloRoofUrl(token)}
            x={0}
            y={0}
            width={ROOF_IMAGE.width}
            height={ROOF_IMAGE.height}
            onError={() => setFailed(true)}
          />
        )}
        {view.drawing ? (
          <g dangerouslySetInnerHTML={{ __html: view.drawing.marks }} />
        ) : (
          <circle cx={ROOF_IMAGE.width / 2} cy={ROOF_IMAGE.height / 2} r={7} fill="#FF5A1F" stroke="white" strokeWidth={2.5} />
        )}
      </svg>
      {view.system && (
        <figcaption className="bg-surface px-4 py-3 text-[14px] text-ink-2">
          A first idea: {view.system.kw} kW of solar, {view.system.panels} panels
          {view.system.batteryKwh ? ` and a ${view.system.batteryKwh} kWh battery` : ""}.
        </figcaption>
      )}
    </figure>
  );
}
