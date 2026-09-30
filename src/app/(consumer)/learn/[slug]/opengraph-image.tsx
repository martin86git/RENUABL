import { ImageResponse } from "next/og";
import { GUIDES, LEARN_NAME, guideBySlug } from "@/lib/domain/guides";

export const alt = "A Learn with Revo guide from RENUABL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

/** Each guide's share image: its title on the brand background. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#FAF9F6",
        padding: "72px 80px",
        color: "#1A1A1A",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#1E3A2E" }}>
        <div style={{ letterSpacing: 10 }}>RENUABL</div>
        <div>{LEARN_NAME}</div>
      </div>
      <div style={{ fontSize: guide && guide.title.length > 60 ? 58 : 68, lineHeight: 1.1, letterSpacing: -1.5 }}>
        {guide?.title ?? "Solar, batteries and rebates, in plain English."}
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#1E3A2E" }}>
        <div style={{ background: "#D9E7DC", borderRadius: 999, padding: "10px 26px" }}>
          {guide ? `${guide.topic} · ${guide.minutes} min read` : "Plain-English guides"}
        </div>
      </div>
    </div>,
    size,
  );
}
