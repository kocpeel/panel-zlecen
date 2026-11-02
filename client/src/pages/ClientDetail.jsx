import { Link, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import OrderTable from '../components/OrderTable.jsx';
import { ErrorNote, PageHeader } from '../components/ui.jsx';
import { useLoad } from '../lib/hooks.js';

export default function ClientDetail() {
  const { id } = useParams();
  const { data: client, error } = useLoad(() => api.getClient(id), [id]);

  if (error && !client) {
    return (
      <>
        <ErrorNote error={error} />
        <Link to="/klienci">Wróć do listy klientów</Link>
      </>
    );
  }
  if (!client) return <p className="muted">Wczytywanie klienta…</p>;

  return (
    <>
      <PageHeader eyebrow="Klient" title={client.name}>
        <Link className="button" to={`/klienci/${client.id}/edycja`}>
          Edytuj
        </Link>
        <Link className="button button-primary" to={`/zlecenia/nowe?klient=${client.id}`}>
          Nowe zlecenie
        </Link>
      </PageHeader>

      <div className="stack">
        <section className="panel">
          <h2>Dane kontaktowe</h2>
          <dl className="facts">
            <div>
              <dt>Telefon</dt>
              <dd>{client.phone ?? 'Brak'}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{client.email ?? 'Brak'}</dd>
            </div>
            <div>
              <dt>Adres</dt>
              <dd>{client.address ?? 'Brak'}</dd>
            </div>
            <div>
              <dt>Uwagi</dt>
              <dd>{client.notes ?? 'Brak'}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="section-title">Zlecenia klienta</h2>
          {client.orders.length === 0 ? (
            <p className="muted">Ten klient nie ma jeszcze zleceń.</p>
          ) : (
            <OrderTable orders={client.orders} showClient={false} />
          )}
        </section>
      </div>
    </>
  );
}
