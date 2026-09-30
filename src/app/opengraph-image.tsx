import { ImageResponse } from "next/og";

export const alt = "RENUABL: a healthier home, powered by the sun";
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
      <div style={{ display: "flex", flexDirection: "column", color: "#1E3A2E" }}>
        <div style={{ fontSize: 34, letterSpacing: 12 }}>RENUABL</div>
        <div style={{ fontSize: 14, letterSpacing: 7, marginTop: 6 }}>HOME &amp; ENERGY</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>A healthier home,</div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>powered by the sun.</div>
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#1E3A2E" }}>
        <div style={{ background: "#D9E7DC", borderRadius: 999, padding: "12px 28px" }}>Your home plan, priced in about two minutes</div>
      </div>
    </div>,
    size,
  );
}
