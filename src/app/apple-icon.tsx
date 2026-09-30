import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen and bookmark icon: an "R" on forest green. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1E3A2E",
        color: "#FAF9F6",
        fontSize: 110,
      }}
    >
      R
    </div>,
    size,
  );
}
