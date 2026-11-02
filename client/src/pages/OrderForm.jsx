import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { centsToInput, parsePrice } from '../../../shared/money.js';
import { fieldErrors, orderSchema } from '../../../shared/validation.js';
import { api } from '../api/index.js';
import { ErrorNote, Field, PageHeader, invalidProps } from '../components/ui.jsx';
import { useLoad } from '../lib/hooks.js';
import { useToast } from '../lib/toast.jsx';

const EMPTY_FORM = {
  clientId: '',
  assigneeId: '',
  device: '',
  problem: '',
  dueDate: '',
  price: '',
  warranty: false,
};

export default function OrderForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ ...EMPTY_FORM, clientId: searchParams.get('klient') ?? '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const clients = useLoad(() => api.listClients({ pageSize: 200 }), []);
  const users = useLoad(() => api.listUsers(), []);
  const existing = useLoad(() => (editing ? api.getOrder(id) : Promise.resolve(null)), [id, editing]);

  useEffect(() => {
    if (!existing.data) return;
    const order = existing.data;
    setForm({
      clientId: String(order.clientId),
      assigneeId: order.assigneeId ? String(order.assigneeId) : '',
      device: order.device,
      problem: order.problem,
      dueDate: order.dueDate ?? '',
      price: centsToInput(order.priceCents),
      warranty: order.warranty,
    });
  }, [existing.data]);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const priceCents = form.warranty ? 0 : parsePrice(form.price);
    const parsed = orderSchema.safeParse({
      clientId: form.clientId ? Number(form.clientId) : undefined,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      device: form.device,
      problem: form.problem,
      dueDate: form.dueDate || null,
      priceCents: priceCents ?? undefined,
      warranty: form.warranty,
    });
    if (!parsed.success) {
      const nextErrors = fieldErrors(parsed.error);
      if (nextErrors.priceCents) nextErrors.priceCents = 'Podaj cenę, np. 450,00.';
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      const saved = editing ? await api.updateOrder(id, parsed.data) : await api.createOrder(parsed.data);
      showToast(editing ? 'Zapisano zmiany.' : `Dodano zlecenie ${saved.number}.`);
      navigate(`/zlecenia/${saved.id}`);
    } catch (error) {
      setFormError(error.message);
      setErrors(error.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  if (existing.error) return <ErrorNote error={existing.error} />;
  if (editing && !existing.data) return <p className="muted">Wczytywanie zlecenia…</p>;

  const technicians = users.data?.filter((user) => user.role === 'technician') ?? [];
  const backTo = editing ? `/zlecenia/${id}` : '/zlecenia';

  return (
    <>
      <PageHeader
        eyebrow={editing ? existing.data.number : 'Karta zlecenia'}
        title={editing ? 'Edycja zlecenia' : 'Nowe zlecenie'}
      />
      <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="form-grid">
          <Field id="order-client" label="Klient" error={errors.clientId}>
            <select
              id="order-client"
              value={form.clientId}
              onChange={update('clientId')}
              {...invalidProps('order-client', errors.clientId)}
            >
              <option value="">Wybierz klienta</option>
              {clients.data?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {!editing && (
              <Link className="field-link" to="/klienci/nowy?powrot=zlecenie">
                Dodaj nowego klienta
              </Link>
            )}
          </Field>

          <Field id="order-assignee" label="Serwisant" error={errors.assigneeId}>
            <select id="order-assignee" value={form.assigneeId} onChange={update('assigneeId')}>
              <option value="">Nieprzypisane</option>
              {technicians.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="form-wide">
            <Field id="order-device" label="Urządzenie" error={errors.device}>
              <input
                id="order-device"
                type="text"
                value={form.device}
                onChange={update('device')}
                {...invalidProps('order-device', errors.device)}
              />
            </Field>
          </div>

          <div className="form-wide">
            <Field id="order-problem" label="Usterka lub usługa" error={errors.problem}>
              <textarea
                id="order-problem"
                rows={4}
                value={form.problem}
                onChange={update('problem')}
                {...invalidProps('order-problem', errors.problem)}
              />
            </Field>
          </div>

          <Field id="order-due" label="Termin" error={errors.dueDate}>
            <input
              id="order-due"
              type="date"
              value={form.dueDate}
              onChange={update('dueDate')}
              {...invalidProps('order-due', errors.dueDate)}
            />
          </Field>

          <Field id="order-price" label="Cena brutto (zł)" error={errors.priceCents}>
            <input
              id="order-price"
              type="text"
              inputMode="decimal"
              placeholder="450,00"
              value={form.warranty ? '' : form.price}
              disabled={form.warranty}
              onChange={update('price')}
              {...invalidProps('order-price', errors.priceCents)}
            />
          </Field>

          <label className="check-row form-wide" htmlFor="order-warranty">
            <input id="order-warranty" type="checkbox" checked={form.warranty} onChange={update('warranty')} />
            Naprawa gwarancyjna, bez opłat
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj zlecenie'}
          </button>
          <Link className="button" to={backTo}>
            Anuluj
          </Link>
        </div>
      </form>
    </>
  );
}
