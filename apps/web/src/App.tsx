import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { NowScreen } from './now/NowScreen.tsx';

// Truth and the engine behind it load only when Truth is opened.
const TruthScreen = lazy(() => import('./truth/TruthScreen.tsx'));

type Screen = 'now' | 'truth';
const screenFromLocation = (): Screen => (location.hash === '#truth' ? 'truth' : 'now');

/**
 * Two screens and the browser history: opening Truth pushes an entry, so the system back
 * gesture (Android) or the browser's back button returns to Now.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>(screenFromLocation);

  useEffect(() => {
    const onPop = () => setScreen(screenFromLocation());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const openTruth = useCallback(() => {
    history.pushState({ truth: true }, '', '#truth');
    setScreen('truth');
  }, []);

  const closeTruth = useCallback(() => {
    if ((history.state as { truth?: boolean } | null)?.truth) history.back();
    else {
      history.replaceState(null, '', location.pathname + location.search);
      setScreen('now');
    }
  }, []);

  if (screen === 'truth') {
    return (
      <Suspense fallback={<main className="truth" aria-busy="true" />}>
        <TruthScreen onClose={closeTruth} />
      </Suspense>
    );
  }
  return <NowScreen onOpenTruth={openTruth} />;
}
