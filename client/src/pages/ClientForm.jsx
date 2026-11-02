import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { clientSchema, fieldErrors } from '../../../shared/validation.js';
import { api } from '../api/index.js';
import { ErrorNote, Field, PageHeader, invalidProps } from '../components/ui.jsx';
import { useLoad } from '../lib/hooks.js';
import { useToast } from '../lib/toast.jsx';

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

export default function ClientForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const returnToOrder = searchParams.get('powrot') === 'zlecenie';

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const existing = useLoad(() => (editing ? api.getClient(id) : Promise.resolve(null)), [id, editing]);

  useEffect(() => {
    if (!existing.data) return;
    const { name, phone, email, address, notes } = existing.data;
    setForm({
      name,
      phone: phone ?? '',
      email: email ?? '',
      address: address ?? '',
      notes: notes ?? '',
    });
  }, [existing.data]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = editing ? await api.updateClient(id, parsed.data) : await api.createClient(parsed.data);
      showToast(editing ? 'Zapisano zmiany.' : `Dodano klienta ${saved.name}.`);
      navigate(returnToOrder ? `/zlecenia/nowe?klient=${saved.id}` : `/klienci/${saved.id}`);
    } catch (error) {
      setFormError(error.message);
      setErrors(error.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  if (existing.error) return <ErrorNote error={existing.error} />;
  if (editing && !existing.data) return <p className="muted">Wczytywanie klienta…</p>;

  const backTo = editing ? `/klienci/${id}` : returnToOrder ? '/zlecenia/nowe' : '/klienci';

  return (
    <>
      <PageHeader eyebrow="Klient" title={editing ? 'Edycja klienta' : 'Nowy klient'} />
      <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="form-grid">
          <div className="form-wide">
            <Field id="client-name" label="Nazwa lub imię i nazwisko" error={errors.name}>
              <input
                id="client-name"
                type="text"
                value={form.name}
                onChange={update('name')}
                {...invalidProps('client-name', errors.name)}
              />
            </Field>
          </div>
          <Field id="client-phone" label="Telefon" error={errors.phone}>
            <input
              id="client-phone"
              type="tel"
              value={form.phone}
              onChange={update('phone')}
              {...invalidProps('client-phone', errors.phone)}
            />
          </Field>
          <Field id="client-email" label="E-mail" error={errors.email}>
            <input
              id="client-email"
              type="email"
              value={form.email}
              onChange={update('email')}
              {...invalidProps('client-email', errors.email)}
            />
          </Field>
          <div className="form-wide">
            <Field id="client-address" label="Adres" error={errors.address}>
              <input
                id="client-address"
                type="text"
                value={form.address}
                onChange={update('address')}
                {...invalidProps('client-address', errors.address)}
              />
            </Field>
          </div>
          <div className="form-wide">
            <Field id="client-notes" label="Uwagi" error={errors.notes}>
              <textarea
                id="client-notes"
                rows={3}
                value={form.notes}
                onChange={update('notes')}
                {...invalidProps('client-notes', errors.notes)}
              />
            </Field>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj klienta'}
          </button>
          <Link className="button" to={backTo}>
            Anuluj
          </Link>
        </div>
      </form>
    </>
  );
}
