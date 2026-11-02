import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { SESSION_EXPIRED } from '../api/errors.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

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

  const startSession = useCallback((signedIn) => {
    setLoggedOut(false);
    setUser(signedIn);
  }, []);
  const login = useCallback(
    async (email, password) => startSession(await api.login(email, password)),
    [startSession],
  );
  const loginAs = useCallback(async (role) => startSession(await api.loginAs(role)), [startSession]);
  const logout = useCallback(async () => {
    await api.logout();
    setLoggedOut(true);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, loggedOut, login, loginAs, logout }),
    [user, ready, loggedOut, login, loginAs, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
