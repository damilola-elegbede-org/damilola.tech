import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Case Studies | Damilola Elegbede";
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
          Engineering Work
        </p>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#F0F6FC",
            margin: "0 0 24px",
            maxWidth: 800,
          }}
        >
          Case{" "}
          <span style={{ color: "#C9A227" }}>Studies</span>
        </h1>
        <p
          style={{
            fontSize: 24,
            color: "#8B949E",
            margin: "0 0 48px",
            maxWidth: 680,
            lineHeight: 1.5,
            fontFamily: "sans-serif",
          }}
        >
          Real production systems. Real constraints. How I diagnosed, fixed,
          and shipped complex engineering under deadline pressure.
        </p>
        <p
          style={{
            fontSize: 18,
            color: "#8B949E",
            fontFamily: "sans-serif",
            margin: 0,
          }}
        >
          damilola.tech/case-studies
        </p>
      </div>
    ),
    size
  );
}
