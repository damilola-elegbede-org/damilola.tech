import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Salsa Con Flow Dance — Case Study | Damilola Elegbede";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0D1117",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontFamily: "sans-serif",
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#60A5FA",
            margin: "0 0 24px",
          }}
        >
          Platform Delivery &amp; Security Hardening
        </p>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#F0F6FC",
            margin: "0 0 24px",
            maxWidth: 860,
          }}
        >
          Salsa Con Flow{" "}
          <span style={{ color: "#C9A227" }}>Dance</span>
        </h1>
        <p
          style={{
            fontSize: 24,
            color: "#8B949E",
            margin: "0 0 48px",
            maxWidth: 700,
            lineHeight: 1.5,
            fontFamily: "sans-serif",
          }}
        >
          Full-stack booking platform — built, secured, and hardened for a
          professional Latin dance instructor with 4 security layers added.
        </p>
        <p
          style={{
            fontSize: 18,
            color: "#8B949E",
            fontFamily: "sans-serif",
            margin: 0,
          }}
        >
          damilola.tech/case-studies/scf-dance
        </p>
      </div>
    ),
    size
  );
}
