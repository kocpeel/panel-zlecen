import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { SESSION_EXPIRED } from '../api/errors.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((current) => active && setUser(current))
      .catch(() => active && setUser(null))
      .finally(() => active && setReady(true));

    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED, onExpired);
    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED, onExpired);
    };
  }, []);

  const login = useCallback(async (email, password) => setUser(await api.login(email, password)), []);
  const loginAs = useCallback(async (role) => setUser(await api.loginAs(role)), []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, loginAs, logout }), [user, ready, login, loginAs, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
