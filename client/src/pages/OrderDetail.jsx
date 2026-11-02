import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatMoney } from '../../../shared/money.js';
import { STATUSES, isClosed } from '../../../shared/statuses.js';
import { api } from '../api/index.js';
import { ErrorNote, Field, OverdueFlag, PageHeader, StatusStamp, invalidProps } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { formatDateTime, formatDay } from '../lib/format.js';
import { useLoad } from '../lib/hooks.js';
import { useToast } from '../lib/toast.jsx';

const ACTION_LABELS = {
  diagnosis: 'Rozpocznij diagnozę',
  repair: 'Rozpocznij naprawę',
  waiting_parts: 'Czeka na części',
  ready: 'Gotowe do odbioru',
  completed: 'Wydaj klientowi',
  cancelled: 'Anuluj zlecenie',
};

function describeEvent(event) {
  if (event.type === 'created') return 'Przyjęto zlecenie';
  if (event.type === 'status') return `Status: ${STATUSES[event.status].label}`;
  return 'Notatka';
}

function StatusPanel({ order, onChanged }) {
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function change(status) {
    setBusy(true);
    setError(null);
    try {
      await api.changeStatus(order.id, { status, note });
      setNote('');
      showToast(`Zmieniono status na „${STATUSES[status].label}”.`);
      await onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Zmień status</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Field id="status-note" label="Notatka do zmiany (opcjonalnie)">
        <textarea id="status-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="status-actions">
        {STATUSES[order.status].next.map((status) => (
          <button
            key={status}
            type="button"
            className={status === 'cancelled' ? 'button button-quiet' : 'button button-primary'}
            disabled={busy}
            onClick={() => change(status)}
          >
            {ACTION_LABELS[status]}
          </button>
        ))}
      </div>
    </section>
  );
}

function NoteForm({ orderId, onAdded }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addNote(orderId, note);
      setNote('');
      await onAdded();
    } catch (failure) {
      setError(failure.fields?.note ?? failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="note-form" onSubmit={handleSubmit} noValidate>
      <Field id="order-note" label="Dodaj notatkę" error={error}>
        <textarea
          id="order-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          {...invalidProps('order-note', error)}
        />
      </Field>
      <button type="submit" className="button" disabled={busy}>
        Zapisz notatkę
      </button>
    </form>
  );
}

function DeleteOrder({ order }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  async function remove() {
    try {
      await api.deleteOrder(order.id);
      showToast(`Usunięto zlecenie ${order.number}.`);
      navigate('/zlecenia');
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="button button-quiet" onClick={() => setConfirming(true)}>
        Usuń
      </button>
    );
  }
  return (
    <div className="confirm" role="group" aria-label="Potwierdzenie usunięcia">
      <span>{error ?? 'Usunąć to zlecenie razem z historią?'}</span>
      <button type="button" className="button button-danger" onClick={remove}>
        Tak, usuń
      </button>
      <button type="button" className="button" onClick={() => setConfirming(false)}>
        Nie
      </button>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: order, error, reload } = useLoad(() => api.getOrder(id), [id]);

  if (error && !order) {
    return (
      <>
        <ErrorNote error={error} />
        <Link to="/zlecenia">Wróć do listy zleceń</Link>
      </>
    );
  }
  if (!order) return <p className="muted">Wczytywanie zlecenia…</p>;

  const closed = isClosed(order.status);

  return (
    <>
      <PageHeader eyebrow="Karta zlecenia" title={<span className="ticket-title">{order.number}</span>}>
        {!closed && (
          <Link className="button" to={`/zlecenia/${order.id}/edycja`}>
            Edytuj
          </Link>
        )}
        {user.role === 'owner' && <DeleteOrder order={order} />}
      </PageHeader>

      <div className="ticket-status">
        <StatusStamp status={order.status} large />
        {order.overdue && <OverdueFlag />}
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="panel">
            <h2>Szczegóły</h2>
            <dl className="facts">
              <div>
                <dt>Urządzenie</dt>
                <dd>{order.device}</dd>
              </div>
              <div className="facts-wide">
                <dt>Usterka lub usługa</dt>
                <dd>{order.problem}</dd>
              </div>
              <div>
                <dt>Termin</dt>
                <dd>{formatDay(order.dueDate)}</dd>
              </div>
              <div>
                <dt>Serwisant</dt>
                <dd>{order.assigneeName ?? 'Nieprzypisane'}</dd>
              </div>
              <div>
                <dt>Cena brutto</dt>
                <dd>{order.warranty ? 'Gwarancja, bez opłat' : formatMoney(order.priceCents)}</dd>
              </div>
              <div>
                <dt>Przyjęto</dt>
                <dd>{formatDateTime(order.createdAt)}</dd>
              </div>
              {order.completedOn && (
                <div>
                  <dt>Wydano</dt>
                  <dd>{formatDay(order.completedOn)}</dd>
                </div>
              )}
            </dl>
          </section>

          {!closed && <StatusPanel order={order} onChanged={reload} />}

          <section className="panel">
            <h2>Historia</h2>
            <NoteForm orderId={order.id} onAdded={reload} />
            <ol className="timeline">
              {order.events.map((event) => (
                <li key={event.id}>
                  <strong>{describeEvent(event)}</strong>
                  {event.note && <p>{event.note}</p>}
                  <small>
                    {formatDateTime(event.createdAt)}
                    {event.userName && `, ${event.userName}`}
                  </small>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="panel client-card">
          <h2>Klient</h2>
          <p className="client-card-name">
            <Link to={`/klienci/${order.client.id}`}>{order.client.name}</Link>
          </p>
          <dl className="facts facts-single">
            {order.client.phone && (
              <div>
                <dt>Telefon</dt>
                <dd>{order.client.phone}</dd>
              </div>
            )}
            {order.client.email && (
              <div>
                <dt>E-mail</dt>
                <dd>{order.client.email}</dd>
              </div>
            )}
            {order.client.address && (
              <div>
                <dt>Adres</dt>
                <dd>{order.client.address}</dd>
              </div>
            )}
            {order.client.notes && (
              <div>
                <dt>Uwagi</dt>
                <dd>{order.client.notes}</dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </>
  );
}
