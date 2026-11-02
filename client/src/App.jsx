import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './lib/auth.jsx';
import ClientDetail from './pages/ClientDetail.jsx';
import ClientForm from './pages/ClientForm.jsx';
import Clients from './pages/Clients.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import OrderForm from './pages/OrderForm.jsx';
import Orders from './pages/Orders.jsx';

function Protected({ children }) {
  const { user, ready, loggedOut } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="loading-screen">Wczytywanie panelu…</p>;
  if (!user) {
    // After an expired session the same person returns to their page. After logging out,
    // the next person to log in starts on the dashboard.
    const state = loggedOut ? null : { from: location.pathname + location.search };
    return <Navigate to="/logowanie" replace state={state} />;
  }
  return children;
}

function NotFound() {
  return (
    <section className="empty">
      <h1>Nie ma takiej strony</h1>
      <p>
        Wróć na <Link to="/">pulpit</Link> i wybierz, co chcesz zrobić.
      </p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/logowanie" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="zlecenia" element={<Orders />} />
        <Route path="zlecenia/nowe" element={<OrderForm />} />
        <Route path="zlecenia/:id" element={<OrderDetail />} />
        <Route path="zlecenia/:id/edycja" element={<OrderForm />} />
        <Route path="klienci" element={<Clients />} />
        <Route path="klienci/nowy" element={<ClientForm />} />
        <Route path="klienci/:id" element={<ClientDetail />} />
        <Route path="klienci/:id/edycja" element={<ClientForm />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
