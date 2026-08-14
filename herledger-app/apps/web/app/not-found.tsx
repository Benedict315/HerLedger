import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        Page not found
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        The page you were looking for does not exist.
      </p>
      <Link href="/">Return to home</Link>
    </main>
  );
}
