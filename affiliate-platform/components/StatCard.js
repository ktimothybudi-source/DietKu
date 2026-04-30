export default function StatCard({ label, value, helper }) {
  return (
    <article className="card stat-card">
      <p className="label">{label}</p>
      <h3>{value}</h3>
      {helper ? <p className="helper">{helper}</p> : null}
    </article>
  );
}
