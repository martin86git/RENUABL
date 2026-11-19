import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SALES_HERO } from "@/lib/domain/design/sales-page";
import { publicSiteUrl } from "@/lib/domain/site";

/**
 * The front page's share picture (19 Nov 2026, Martin: the preview iMessage shows when he texts www.renuabl.com.au to a
 * customer should be "super impactful and interesting for someone to open"). What iMessage, Facebook and the rest draw
 * under the link: the page's own headline large enough to read on a phone, in the studio's graphite with the signal
 * orange, Sol's sun lit, and the real product (Today, with Sol on a live call) leaning in from the right. Nothing in it
 * that the page doesn't say. Made once and kept (force-static); the screenshot is read from the live site.
 */
export const dynamic = "force-static";

const SIZE = { width: 1200, height: 630 };
const ORANGE = "#FF5A1F";

/**
 * Sol as the page shows him (19 Nov 2026, Martin: the brain should have Sol's faint sun behind it, as on the website): the
 * hero's live sun with its brain, captured once with a see-through glow (`public/design/landing/sol-brain.png`; the disc
 * is half its width). Read from disk when the picture is made.
 */
const SOL_PNG = `data:image/png;base64,${readFileSync(join(process.cwd(), "public/design/landing/sol-brain.png")).toString("base64")}`;

/** A voice agent's mark, as the page draws it: a graphite round with the wave in its colour. */
function VoiceMark({ size, colour = ORANGE }: { size: number; colour?: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: 9999,
        background: "radial-gradient(circle at 35% 30%, #34373e 0%, #1d1f24 60%, #141519 100%)",
        border: `1px solid ${colour}66`,
        boxShadow: `0 6px 22px ${colour}55`,
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.06,
      }}
    >
      {[0.35, 0.7, 1, 0.6, 0.35].map((v, i) => (
        <div key={i} style={{ width: size * 0.07, height: size * 0.42 * v, borderRadius: 9, background: colour }} />
      ))}
    </div>
  );
}

export function GET() {
  const shot = `${publicSiteUrl()}/design/landing/today.jpg`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #17181b 0%, #26292e 55%, #33261f 100%)",
        color: "#ffffff",
      }}
    >
      {/* The sun's warm light, behind everything. */}
      <div
        style={{
          position: "absolute",
          right: -140,
          top: -180,
          width: 720,
          height: 720,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(255,90,31,0.45) 0%, rgba(255,90,31,0.12) 40%, rgba(255,90,31,0) 70%)",
        }}
      />
      {/* The product, leaning in from the right. */}
      <div
        style={{
          position: "absolute",
          left: 650,
          top: 210,
          width: 700,
          height: 438,
          display: "flex",
          borderRadius: 22,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
          transform: "rotate(-4deg)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn by ImageResponse, not the browser */}
        <img src={shot} width={700} height={438} alt="" style={{ objectFit: "cover" }} />
      </div>
      {/* Sol, his brain lit, rising over the product. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn by ImageResponse, not the browser */}
      <img src={SOL_PNG} width={460} height={460} alt="" style={{ position: "absolute", left: 665, top: -71 }} />
      {/* Sol on a live call, over the screenshot. */}
      <div
        style={{
          position: "absolute",
          left: 620,
          top: 500,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 22px 14px 14px",
          borderRadius: 999,
          background: "#ffffff",
          color: "#1d1f23",
          fontSize: 24,
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
      >
        <VoiceMark size={44} />
        <div style={{ display: "flex" }}>Sol is on the call with Doug</div>
        <div style={{ display: "flex", width: 12, height: 12, borderRadius: 999, background: "#22c55e" }} />
      </div>

      {/* The words. */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px", width: 640 }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 10 }}>RENUABL</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1, letterSpacing: -3.5, fontWeight: 600 }}>{SALES_HERO.headline[0]}</div>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05, letterSpacing: -3.5, fontWeight: 600, color: ORANGE }}>
            {SALES_HERO.headline[1]}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 14,
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: -1.5,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {SALES_HERO.andVoice}
            <VoiceMark size={52} />
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 28, color: "rgba(255,255,255,0.72)" }}>{SALES_HERO.sub}</div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", padding: "14px 30px", borderRadius: 999, background: ORANGE, fontSize: 28, fontWeight: 600 }}>
            See it work →
          </div>
        </div>
      </div>
    </div>,
    SIZE,
  );
}
