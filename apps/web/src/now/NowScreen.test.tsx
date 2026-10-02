import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NowFace } from './NowScreen.tsx';

describe('NowFace', () => {
  const now = new Date(2026, 9, 2, 21, 7, 42);
  const html = renderToStaticMarkup(<NowFace now={now} />);

  it('shows the word Aletheia', () => {
    expect(html).toContain('>Aletheia</h1>');
  });

  it('shows local time to the second', () => {
    expect(html).toContain('>21:07:42</time>');
  });

  it('draws one ring and sixty ticks, lighting only the current second', () => {
    expect(html.match(/<circle /g)).toHaveLength(1);
    expect(html.match(/<line /g)).toHaveLength(60);
    expect(html.match(/tick-now/g)).toHaveLength(1);
  });
});
