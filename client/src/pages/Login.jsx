import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, fieldErrors } from '../../../shared/validation.js';
import { isDemo } from '../api/index.js';
import { Field, invalidProps } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { user, login, loginAs } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  const destination = location.state?.from ?? '/';
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(error.message);
      setErrors(error.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-card">
        <span className="brand-mark brand-mark-large" aria-hidden="true">
          ZL
        </span>
        <h1>Panel zleceń</h1>

        {isDemo ? (
          <div className="login-demo">
            <p>To wersja demonstracyjna na fikcyjnych danych. Wybierz, kim chcesz się zalogować.</p>
            <button type="button" className="button button-primary" onClick={() => loginAs('owner')}>
              Wejdź jako właściciel
            </button>
            <button type="button" className="button" onClick={() => loginAs('technician')}>
              Wejdź jako serwisant
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="stack">
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <Field id="login-email" label="E-mail" error={errors.email}>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                {...invalidProps('login-email', errors.email)}
              />
            </Field>
            <Field id="login-password" label="Hasło" error={errors.password}>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                {...invalidProps('login-password', errors.password)}
              />
            </Field>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Logowanie…' : 'Zaloguj się'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
