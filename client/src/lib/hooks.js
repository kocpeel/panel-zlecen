import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Loads data and keeps the previous result on screen during a reload, so the layout doesn't jump.
export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(() => {
    latest.current += 1;
    const requestId = latest.current;
    setState((previous) => ({ ...previous, loading: true }));
    return load().then(
      (data) => {
        if (requestId === latest.current) setState({ data, error: null, loading: false });
      },
      (error) => {
        if (requestId === latest.current) setState((previous) => ({ ...previous, error, loading: false }));
      },
    );
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Tracks an element's width, so a chart can draw at real pixels and keep its text a readable size.
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
