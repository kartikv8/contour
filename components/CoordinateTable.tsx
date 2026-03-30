type CoordinateTableProps = {
  coordinates: [number, number][];
};

export function CoordinateTable({ coordinates }: CoordinateTableProps) {
  return (
    <section className="panel" aria-label="Coordinate preview">
      <h2>Coordinate Preview</h2>
      {coordinates.length === 0 ? (
        <p>No coordinates yet.</p>
      ) : (
        <table className="coords-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Lng</th>
              <th>Lat</th>
            </tr>
          </thead>
          <tbody>
            {coordinates.map(([lng, lat], index) => (
              <tr key={`${lng}-${lat}-${index}`}>
                <td>{index + 1}</td>
                <td>{lng.toFixed(6)}</td>
                <td>{lat.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
