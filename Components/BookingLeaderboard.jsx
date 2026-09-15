import { formatNumber } from "../src/analytics/insightUtils";

export default function BookingLeaderboard({ rows = [], emptyMessage }) {
  if (!rows.length) return <div className="chart-empty chart-empty--compact">{emptyMessage}</div>;

  const leaders = rows.slice(0, 3);
  const remaining = rows.slice(3, 10);

  return <div className="booking-ranking">
    <ol className="booking-leaderboard" aria-label="Top three by booking frequency">
      {leaders.map((row, index) => <li key={`${row.name}-${index}`} className={`booking-leaderboard__place booking-leaderboard__place--${index + 1}`}>
        <span className="booking-leaderboard__rank">{String(index + 1).padStart(2, "0")}</span>
        <strong>{row.name}</strong>
        <b>{formatNumber(row.value)} <small>bookings</small></b>
      </li>)}
    </ol>

    {remaining.length > 0 && <ol className="booking-ranking__continuation" start={4} aria-label="Ranks four through ten">
      {remaining.map((row, index) => <li key={`${row.name}-${index + 3}`}>
        <span>{String(index + 4).padStart(2, "0")}</span>
        <strong>{row.name}</strong>
        <b>{formatNumber(row.value)} <small>bookings</small></b>
      </li>)}
    </ol>}
  </div>;
}
