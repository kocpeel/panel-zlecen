import { useId } from 'react';
import { STATUSES } from '../../../shared/statuses.js';

export function StatusStamp({ status, large = false }) {
  const { label, tone } = STATUSES[status];
  return <span className={`stamp stamp-${tone}${large ? ' stamp-large' : ''}`}>{label}</span>;
}

export function OverdueFlag() {
  return (
    <span className="overdue-flag">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M8 1.5 15 14H1L8 1.5Zm-.8 4.7v4h1.6v-4H7.2Zm0 5v1.6h1.6v-1.6H7.2Z" fill="currentColor" />
      </svg>
      Po terminie
    </span>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export const invalidProps = (id, error) =>
  error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};

export function ErrorNote({ error, onRetry }) {
  return (
    <div className="error-note" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange, noun }) {
  const id = useId();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav className="pagination" aria-labelledby={id}>
      <span id={id}>
        {first}–{last} z {total} {noun}
      </span>
      <div className="pagination-actions">
        <button type="button" className="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Poprzednia
        </button>
        <button type="button" className="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Następna
        </button>
      </div>
    </nav>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
