import { Link } from 'react-router-dom';
import { formatMoney } from '../../../shared/money.js';
import { STATUSES } from '../../../shared/statuses.js';
import { api } from '../api/index.js';
import RevenueChart from '../components/RevenueChart.jsx';
import { ErrorNote, PageHeader } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { countOrders, describeDue, formatDay, formatMonthLong } from '../lib/format.js';
import { useLoad } from '../lib/hooks.js';

function StatTile({ label, value, detail, to, tone }) {
  return (
    <Link to={to} className={`tile${tone ? ` tile-${tone}` : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {detail && <span className="tile-detail">{detail}</span>}
    </Link>
  );
}

function StatusBars({ byStatus }) {
  const max = Math.max(1, ...byStatus.map((row) => row.count));
  return (
    <ul className="status-bars">
      {byStatus.map(({ status, count }) => (
        <li key={status}>
          <Link to={`/zlecenia?status=${status}`} className="status-bar-row">
            <span className="status-bar-label">{STATUSES[status].label}</span>
            <span className="status-bar-track">
              <span className="status-bar-fill" style={{ '--share': count / max }} />
              <span className="status-bar-value">{count}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, reload } = useLoad(() => api.dashboard(), [user.id]);

  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <p className="muted">Wczytywanie pulpitu…</p>;

  const currentRevenue = data.revenue?.at(-1);

  return (
    <>
      <PageHeader eyebrow={formatDay(data.today)} title="Pulpit">
        <Link to="/zlecenia/nowe" className="button button-primary">
          Nowe zlecenie
        </Link>
      </PageHeader>

      <div className="tiles">
        <StatTile label="Otwarte zlecenia" value={data.openCount} to="/zlecenia?status=open" />
        <StatTile
          label="Po terminie"
          value={data.overdueCount}
          to="/zlecenia?overdue=1"
          tone={data.overdueCount > 0 ? 'critical' : undefined}
        />
        <StatTile label="Gotowe do odbioru" value={data.readyCount} to="/zlecenia?status=ready" />
        {currentRevenue ? (
          <StatTile
            label="Przychód w tym miesiącu"
            value={formatMoney(currentRevenue.cents)}
            detail={countOrders(currentRevenue.count)}
            to="/zlecenia?status=completed"
          />
        ) : (
          <StatTile label="Wydane w tym miesiącu" value={data.completedThisMonth} to="/zlecenia?status=completed" />
        )}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Wymaga uwagi</h2>
          <p className="panel-note">Zlecenia po terminie albo z terminem w ciągu 3 dni.</p>
          {data.attention.length === 0 ? (
            <p className="muted">Wszystkie terminy są pod kontrolą.</p>
          ) : (
            <ul className="attention-list">
              {data.attention.map((order) => (
                <li key={order.id}>
                  <Link to={`/zlecenia/${order.id}`} className="attention-row">
                    <span className="ticket-no">{order.number}</span>
                    <span className="attention-main">
                      <strong>{order.clientName}</strong>
                      <span className="muted">{order.device}</span>
                    </span>
                    <span className={order.overdue ? 'attention-due is-late' : 'attention-due'}>
                      {describeDue(order.dueDate, data.today)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Otwarte zlecenia według statusu</h2>
          <p className="panel-note">Kliknij status, aby zobaczyć listę.</p>
          <StatusBars byStatus={data.byStatus} />
        </section>

        {data.revenue && (
          <section className="panel panel-wide">
            <h2>Przychód z wydanych zleceń</h2>
            <p className="panel-note">
              {formatMonthLong(data.revenue[0].month)} – {formatMonthLong(data.revenue.at(-1).month)}. Bieżący miesiąc
              jeszcze trwa.
            </p>
            <RevenueChart months={data.revenue} />
          </section>
        )}
      </div>
    </>
  );
}
