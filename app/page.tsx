import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        maxWidth: "34rem",
        margin: "0 auto",
        padding: "3rem 1.25rem",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        color: "#14171A",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", margin: "0 0 .5rem" }}>Lastmile</h1>
      <p style={{ color: "#3E4650", lineHeight: 1.6 }}>
        Voice-first delivery exception reporting. A driver finishes a drop, says what happened,
        and the agent asks only for the details they left out.
      </p>
      <p>
        <Link href="/drive" style={{ color: "#C06E05", fontWeight: 600 }}>
          Open the driver screen
        </Link>
      </p>
    </main>
  );
}
