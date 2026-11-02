import { Link } from 'react-router-dom';
import { formatMoney } from '../../../shared/money.js';
import { formatDay } from '../lib/format.js';
import { OverdueFlag, StatusStamp } from './ui.jsx';

// On narrow screens the stylesheet turns each row into a labelled card, using data-label.
export default function OrderTable({ orders, showClient = true }) {
  return (
    <table className="data-table order-table">
      <thead>
        <tr>
          <th scope="col">Numer</th>
          {showClient && <th scope="col">Klient</th>}
          <th scope="col">Urządzenie</th>
          <th scope="col">Status</th>
          <th scope="col">Termin</th>
          <th scope="col">Serwisant</th>
          <th scope="col" className="numeric">
            Cena
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td data-label="Numer">
              <Link className="ticket-no" to={`/zlecenia/${order.id}`}>
                {order.number}
              </Link>
            </td>
            {showClient && <td data-label="Klient">{order.clientName}</td>}
            <td data-label="Urządzenie">{order.device}</td>
            <td data-label="Status">
              <StatusStamp status={order.status} />
            </td>
            <td data-label="Termin">
              <span className="due-cell">
                {formatDay(order.dueDate)}
                {order.overdue && <OverdueFlag />}
              </span>
            </td>
            <td data-label="Serwisant">{order.assigneeName ?? <span className="muted">Nieprzypisane</span>}</td>
            <td data-label="Cena" className="numeric">
              {order.warranty ? <span className="muted">Gwarancja</span> : formatMoney(order.priceCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
