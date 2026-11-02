import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { STATUSES, STATUS_KEYS } from '../../../shared/statuses.js';
import { api, isDemo } from '../api/index.js';
import OrderTable from '../components/OrderTable.jsx';
import { ErrorNote, PageHeader, Pagination } from '../components/ui.jsx';
import { plural } from '../lib/format.js';
import { useDebouncedValue, useLoad } from '../lib/hooks.js';

const SORT_OPTIONS = [
  ['newest', 'Najnowsze'],
  ['due', 'Najbliższy termin'],
  ['client', 'Klient A–Ż'],
  ['price', 'Najwyższa cena'],
];

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const assignee = searchParams.get('assignee') ?? '';
  const overdue = searchParams.get('overdue') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Number(searchParams.get('page')) || 1;
  const urlQuery = searchParams.get('q') ?? '';

  const [search, setSearch] = useState(urlQuery);
  const debouncedSearch = useDebouncedValue(search);

  function updateFilters(changes) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!('page' in changes)) next.delete('page');
        Object.entries(changes).forEach(([key, value]) => {
          if (value) next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (debouncedSearch !== urlQuery) updateFilters({ q: debouncedSearch });
    // Only a settled search should change the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const params = { status, assignee, overdue, sort, page, q: urlQuery, pageSize: 20 };
  const orders = useLoad(() => api.listOrders(params), [status, assignee, overdue, sort, page, urlQuery]);
  const users = useLoad(() => api.listUsers(), []);
  const technicians = users.data?.filter((user) => user.role === 'technician') ?? [];
  const exportUrl = api.exportOrdersUrl({ status, assignee, overdue, sort, q: urlQuery });
  const hasFilters = Boolean(status || assignee || overdue || urlQuery);

  function clearFilters() {
    setSearch('');
    setSearchParams({}, { replace: true });
  }

  return (
    <>
      <PageHeader title="Zlecenia">
        {!isDemo && exportUrl && (
          <a className="button" href={exportUrl}>
            Eksportuj CSV
          </a>
        )}
        <Link to="/zlecenia/nowe" className="button button-primary">
          Nowe zlecenie
        </Link>
      </PageHeader>

      <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="filter filter-search">
          <label htmlFor="orders-search">Szukaj</label>
          <input
            id="orders-search"
            type="search"
            placeholder="Numer, klient lub urządzenie"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter">
          <label htmlFor="orders-status">Status</label>
          <select
            id="orders-status"
            value={status}
            onChange={(event) => updateFilters({ status: event.target.value })}
          >
            <option value="">Wszystkie</option>
            <option value="open">Wszystkie otwarte</option>
            {STATUS_KEYS.map((key) => (
              <option key={key} value={key}>
                {STATUSES[key].label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="orders-assignee">Serwisant</label>
          <select
            id="orders-assignee"
            value={assignee}
            onChange={(event) => updateFilters({ assignee: event.target.value })}
          >
            <option value="">Wszyscy</option>
            <option value="none">Nieprzypisane</option>
            {technicians.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter">
          <label htmlFor="orders-sort">Sortowanie</label>
          <select
            id="orders-sort"
            value={sort}
            onChange={(event) => updateFilters({ sort: event.target.value === 'newest' ? '' : event.target.value })}
          >
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="filter-check" htmlFor="orders-overdue">
          <input
            id="orders-overdue"
            type="checkbox"
            checked={overdue === '1'}
            onChange={(event) => updateFilters({ overdue: event.target.checked ? '1' : '' })}
          />
          Tylko po terminie
        </label>
      </form>

      {orders.error && <ErrorNote error={orders.error} onRetry={orders.reload} />}

      {orders.data &&
        (orders.data.items.length === 0 ? (
          <section className="empty">
            <h2>Brak zleceń</h2>
            {hasFilters ? (
              <>
                <p>Żadne zlecenie nie pasuje do tych filtrów.</p>
                <button type="button" className="button" onClick={clearFilters}>
                  Wyczyść filtry
                </button>
              </>
            ) : (
              <p>Dodaj pierwsze zlecenie przyciskiem „Nowe zlecenie”.</p>
            )}
          </section>
        ) : (
          <div className={orders.loading ? 'is-refreshing' : undefined}>
            <OrderTable orders={orders.data.items} />
            <Pagination
              page={orders.data.page}
              pageSize={orders.data.pageSize}
              total={orders.data.total}
              noun={plural(orders.data.total, 'zlecenia', 'zleceń', 'zleceń')}
              onChange={(next) => updateFilters({ page: next > 1 ? String(next) : '' })}
            />
          </div>
        ))}
    </>
  );
}
