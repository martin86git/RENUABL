import { ImageResponse } from "next/og";

export const alt = "RENUABL: solar and batteries, sized to your bill";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share image for every page without its own (brand colours, no photos). */
export default function Image() {
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
      <div style={{ fontSize: 34, letterSpacing: 12, color: "#1E3A2E" }}>RENUABL</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>Solar and batteries,</div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>sized to your bill.</div>
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#1E3A2E" }}>
        <div style={{ background: "#D9E7DC", borderRadius: 999, padding: "12px 28px" }}>Your system, priced in about two minutes</div>
      </div>
    </div>,
    size,
  );
}
