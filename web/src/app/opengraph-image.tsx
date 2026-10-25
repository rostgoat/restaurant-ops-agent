import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "Restaurant ops agent: an applied AI case study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#1c1c1e",
          color: "#f2f2f4",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#4c8dff" }}>Applied AI case study</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            An AI agent that answers a restaurant&apos;s questions and never acts on its own.
          </div>
          <div style={{ display: "flex", gap: 36, fontSize: 30 }}>
            <span style={{ color: "#b197fc" }}>the model proposes</span>
            <span style={{ color: "#4fd1c5" }}>code checks</span>
            <span style={{ color: "#ff8097" }}>a person approves</span>
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#9a9aa3" }}>{SITE_NAME}</div>
      </div>
    ),
    size,
  );
}
