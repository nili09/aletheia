import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { NowScreen } from './now/NowScreen.tsx';

// Truth, Charts and the engine behind them load only when opened.
const TruthScreen = lazy(() => import('./truth/TruthScreen.tsx'));
const ChartsScreen = lazy(() => import('./birth/ChartsScreen.tsx'));
const BirthScreen = lazy(() => import('./birth/BirthScreen.tsx'));

type Screen = 'now' | 'truth' | 'charts' | 'new';
const SCREENS: Record<string, Screen> = { '#truth': 'truth', '#charts': 'charts', '#new': 'new' };
const screenFromLocation = (): Screen => SCREENS[location.hash] ?? 'now';

/**
 * Screens and the browser history: opening a screen pushes an entry, so the system back
 * gesture (Android) or the browser's back button returns to the one before.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>(screenFromLocation);

  useEffect(() => {
    const onPop = () => setScreen(screenFromLocation());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((to: Exclude<Screen, 'now'>) => {
    history.pushState({ screen: to }, '', `#${to}`);
    setScreen(to);
  }, []);

  const back = useCallback(() => {
    if ((history.state as { screen?: string } | null)?.screen) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      setScreen('now');
    }
  }, []);

  /** After saving a chart: replace the entry form with the list, so back does not reopen the form. */
  const saved = useCallback(() => {
    history.replaceState({ screen: 'charts' }, '', '#charts');
    setScreen('charts');
  }, []);

  if (screen === 'now') return <NowScreen onOpenTruth={() => open('truth')} onOpenCharts={() => open('charts')} />;
  return (
    <Suspense fallback={<main className="page" aria-busy="true" />}>
      {screen === 'truth' && <TruthScreen onClose={back} />}
      {screen === 'charts' && <ChartsScreen onClose={back} onNew={() => open('new')} />}
      {screen === 'new' && <BirthScreen onClose={back} onSaved={saved} />}
    </Suspense>
  );
}
