import type { HTMLAttributes } from 'react';
import { formatClock, formatLongDate, formatUtcOffset } from './time.ts';
import { useLongPress } from './useLongPress.ts';
import { useNow } from './useNow.ts';

const RING_R = 470;
const TICK_OUTER = 452;
const TICK_MINOR = 440;
const TICK_MAJOR = 428;

const ticks = Array.from({ length: 60 }, (_, i) => {
  const a = (i * Math.PI) / 30;
  const inner = i % 5 === 0 ? TICK_MAJOR : TICK_MINOR;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  return { i, x1: sin * TICK_OUTER, y1: -cos * TICK_OUTER, x2: sin * inner, y2: -cos * inner };
});

/** The face itself: a pure function of the instant, so it renders identically in tests. */
export function NowFace({ now, dialProps, onOpenCharts }: { now: Date; dialProps?: HTMLAttributes<HTMLDivElement>; onOpenCharts?: () => void }) {
  const second = now.getSeconds();

  return (
    <main className="now">
      <div className="dial" {...dialProps}>
        <svg viewBox="-500 -500 1000 1000" aria-hidden="true" className="dial-svg">
          <circle r={RING_R} className="ring" />
          {ticks.map((t) => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={t.i === second ? 'tick tick-now' : t.i % 5 === 0 ? 'tick tick-major' : 'tick'}
            />
          ))}
        </svg>

        <div className="readout">
          <time className="clock" dateTime={now.toISOString()} role="timer" aria-live="off">
            {formatClock(now)}
          </time>
          <p className="date">{formatLongDate(now)}</p>
          <p className="zone">{formatUtcOffset(now)}</p>
        </div>
      </div>

      <h1 className="wordmark">Aletheia</h1>
      {onOpenCharts && (
        <button type="button" className="control" onClick={onOpenCharts}>
          Charts
        </button>
      )}
    </main>
  );
}

/** Now. Pressing and holding the ring opens the hidden Truth screen. */
export function NowScreen({ onOpenTruth, onOpenCharts }: { onOpenTruth: () => void; onOpenCharts: () => void }) {
  const longPress = useLongPress(onOpenTruth);
  return (
    <NowFace
      now={useNow()}
      onOpenCharts={onOpenCharts}
      dialProps={{
        ...longPress,
        role: 'button',
        tabIndex: 0,
        'aria-label': 'Truth: press and hold the ring',
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenTruth();
          }
        },
      }}
    />
  );
}
