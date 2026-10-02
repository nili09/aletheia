import { useEffect, useState } from 'react';
import { msToNextSecond } from './time.ts';

/**
 * The current instant, refreshed on each whole second of the system clock
 * (not every 1000 ms from mount, which would drift against the wall clock).
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msToNextSecond(Date.now()));
    };

    // Timers are throttled in background tabs; resync the moment we are visible again.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      setNow(new Date());
      schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return now;
}
