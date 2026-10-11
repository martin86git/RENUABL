import { ImageResponse } from "next/og";

export const alt = "Your proposal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The picture a messaging app shows when a proposal's link is shared. It is
 * here so the site-wide one (RENUABL's own) isn't used: a proposal is the
 * business's, sent to its customer. Plain on purpose, and it says nothing of
 * what is in the proposal: it is drawn without opening it.
 */
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f6f4",
        color: "#16181d",
        fontSize: 84,
        letterSpacing: -2,
      }}
    >
      Your proposal
    </div>,
    size,
  );
}
