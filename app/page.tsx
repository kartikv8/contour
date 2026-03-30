import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <h1>Geofence Polygon Builder</h1>
      <p>Open the builder workspace.</p>
      <Link href="/geofence-builder">Go to geofence builder</Link>
    </main>
  );
}
