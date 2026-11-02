import { Link, NavLink, Outlet } from 'react-router-dom';
import { ROLE_LABELS } from '../../../shared/statuses.js';
import { isDemo } from '../api/index.js';
import { useAuth } from '../lib/auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <header className="rail">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ZL
          </span>
          <span className="brand-text">
            <strong>Panel zleceń</strong>
            <small>Serwis klimatyzacji</small>
          </span>
        </Link>
        <nav className="rail-nav" aria-label="Główne sekcje">
          <NavLink to="/" end>
            Pulpit
          </NavLink>
          <NavLink to="/zlecenia">Zlecenia</NavLink>
          <NavLink to="/klienci">Klienci</NavLink>
        </nav>
        <div className="rail-user">
          <span className="rail-user-name">
            {user.name}
            <small>{ROLE_LABELS[user.role]}</small>
          </span>
          <button type="button" className="rail-logout" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </header>
      <main className="main">
        {isDemo && (
          <p className="demo-note">Wersja demonstracyjna. Firma i dane są fikcyjne, a zmiany znikają po odświeżeniu.</p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
