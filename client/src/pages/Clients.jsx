import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { ErrorNote, PageHeader, Pagination } from '../components/ui.jsx';
import { plural } from '../lib/format.js';
import { useDebouncedValue, useLoad } from '../lib/hooks.js';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search);
  const clients = useLoad(() => api.listClients({ q: query, page, pageSize: 20 }), [query, page]);

  function handleSearch(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Klienci">
        <Link to="/klienci/nowy" className="button button-primary">
          Nowy klient
        </Link>
      </PageHeader>

      <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="filter filter-search">
          <label htmlFor="clients-search">Szukaj</label>
          <input
            id="clients-search"
            type="search"
            placeholder="Nazwa, telefon lub e-mail"
            value={search}
            onChange={handleSearch}
          />
        </div>
      </form>

      {clients.error && <ErrorNote error={clients.error} onRetry={clients.reload} />}

      {clients.data &&
        (clients.data.items.length === 0 ? (
          <section className="empty">
            <h2>Brak klientów</h2>
            <p>{query ? 'Nikt nie pasuje do tego wyszukiwania.' : 'Dodaj pierwszego klienta.'}</p>
          </section>
        ) : (
          <div className={clients.loading ? 'is-refreshing' : undefined}>
            <table className="data-table client-table">
              <thead>
                <tr>
                  <th scope="col">Klient</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">E-mail</th>
                  <th scope="col" className="numeric">
                    Otwarte
                  </th>
                  <th scope="col" className="numeric">
                    Wszystkie
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.data.items.map((client) => (
                  <tr key={client.id}>
                    <td data-label="Klient">
                      <Link to={`/klienci/${client.id}`}>{client.name}</Link>
                    </td>
                    <td data-label="Telefon">{client.phone ?? <span className="muted">Brak</span>}</td>
                    <td data-label="E-mail">{client.email ?? <span className="muted">Brak</span>}</td>
                    <td data-label="Otwarte" className="numeric">
                      {client.ordersOpen}
                    </td>
                    <td data-label="Wszystkie" className="numeric">
                      {client.ordersTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={clients.data.page}
              pageSize={clients.data.pageSize}
              total={clients.data.total}
              noun={plural(clients.data.total, 'klienta', 'klientów', 'klientów')}
              onChange={setPage}
            />
          </div>
        ))}
    </>
  );
}
