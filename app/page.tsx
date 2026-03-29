import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>Geofence Polygon Builder</h1>
      <p>Milestone 1 foundation is in place.</p>
      <p>
        Continue to the builder: <Link href="/geofence-builder">/geofence-builder</Link>
      </p>
    </main>
  );
}
