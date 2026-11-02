import { useState } from 'react';
import { formatMoney } from '../../../shared/money.js';
import { countOrders, formatCompactPln, formatMonthLong, formatMonthShort } from '../lib/format.js';
import { useElementWidth } from '../lib/hooks.js';

const HEIGHT = 232;
const MARGIN = { top: 26, right: 8, bottom: 26, left: 62 };
const MAX_BAR_WIDTH = 24;
const CORNER = 4;
const TOOLTIP_WIDTH = 150;
const TOOLTIP_HEIGHT = 76;
const TOOLTIP_GAP = 10;

// Picks a round axis step (1, 2 or 5 times a power of ten) giving about four intervals.
function axisTicks(maxCents) {
  if (maxCents <= 0) return [0, 100_000];
  const rough = maxCents / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((value) => value >= rough);
  const ticks = [];
  for (let value = 0; value < maxCents + step; value += step) ticks.push(value);
  return ticks;
}

// A column with rounded data-end corners and a square foot on the baseline.
function columnPath(x, y, width, baseline) {
  const radius = Math.min(CORNER, baseline - y, width / 2);
  return [
    `M${x},${baseline}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${baseline}`,
    'Z',
  ].join(' ');
}

// Beside the column rather than above it, so the tooltip never covers the bar it describes.
function tooltipPosition({ center, barWidth, barTop, width }) {
  const onRight = center + barWidth / 2 + TOOLTIP_GAP;
  const left = onRight + TOOLTIP_WIDTH <= width ? onRight : center - barWidth / 2 - TOOLTIP_GAP - TOOLTIP_WIDTH;
  return {
    left: Math.max(0, left),
    top: Math.min(Math.max(0, barTop - 10), HEIGHT - TOOLTIP_HEIGHT),
  };
}

export default function RevenueChart({ months }) {
  const [ref, width] = useElementWidth();
  const [activeIndex, setActiveIndex] = useState(null);

  const maxCents = Math.max(...months.map((month) => month.cents));
  const ticks = axisTicks(maxCents);
  const top = ticks.at(-1);
  const baseline = HEIGHT - MARGIN.bottom;
  const plotHeight = baseline - MARGIN.top;
  const yFor = (cents) => baseline - (cents / top) * plotHeight;
  const band = Math.max(0, width - MARGIN.left - MARGIN.right) / months.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.6);
  const lastIndex = months.length - 1;
  const peakIndex = months.findIndex((month) => month.cents === maxCents);
  const labelled = new Set([lastIndex, peakIndex]);
  const active = activeIndex === null ? null : months[activeIndex];

  return (
    <figure className="chart">
      <div className="chart-plot" ref={ref} style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="group" aria-label="Przychód z wydanych zleceń w kolejnych miesiącach">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  className={tick === 0 ? 'chart-baseline' : 'chart-grid'}
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                />
                <text className="chart-tick" x={MARGIN.left - 8} y={yFor(tick)} dy="0.32em" textAnchor="end">
                  {tick === 0 ? '0' : formatCompactPln(tick)}
                </text>
              </g>
            ))}

            {months.map((month, index) => {
              const center = MARGIN.left + band * index + band / 2;
              const y = yFor(month.cents);
              const summary = `${formatMonthLong(month.month)}: ${formatMoney(month.cents)}, ${countOrders(month.count)}`;
              return (
                <g key={month.month} className={activeIndex === index ? 'chart-mark is-active' : 'chart-mark'}>
                  {month.cents > 0 && (
                    <path className="chart-column" d={columnPath(center - barWidth / 2, y, barWidth, baseline)} />
                  )}
                  {labelled.has(index) && month.cents > 0 && (
                    <text className="chart-value" x={center} y={y - 8} textAnchor="middle">
                      {formatCompactPln(month.cents)}
                    </text>
                  )}
                  <text className="chart-tick" x={center} y={HEIGHT - 8} textAnchor="middle">
                    {formatMonthShort(month.month)}
                  </text>
                  <rect
                    className="chart-hit"
                    x={center - band / 2}
                    y={MARGIN.top - 20}
                    width={band}
                    height={HEIGHT - MARGIN.top - MARGIN.bottom + 20 + MARGIN.bottom}
                    tabIndex={0}
                    role="img"
                    aria-label={summary}
                    onPointerEnter={() => setActiveIndex(index)}
                    onPointerLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {active && (
          <div
            className="chart-tooltip"
            style={tooltipPosition({
              center: MARGIN.left + band * activeIndex + band / 2,
              barWidth,
              barTop: yFor(active.cents),
              width,
            })}
          >
            <strong>{formatMoney(active.cents)}</strong>
            <span>{formatMonthLong(active.month)}</span>
            <span>{countOrders(active.count)}</span>
          </div>
        )}
      </div>

      <details className="chart-table">
        <summary>Pokaż dane w tabeli</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Miesiąc</th>
              <th scope="col" className="numeric">
                Wydane
              </th>
              <th scope="col" className="numeric">
                Przychód
              </th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month}>
                <td>{formatMonthLong(month.month)}</td>
                <td className="numeric">{month.count}</td>
                <td className="numeric">{formatMoney(month.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
