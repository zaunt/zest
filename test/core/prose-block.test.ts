import {describe, it, expect} from 'vitest';
import {parseScenario} from '../../src/core/internal/parse-scenario';

describe('prose block handling', () => {
  it('throws an error for bullet lists outside prose blocks', () => {
    const markdown = `
# List test

- Item 1
- Item 2
`;
    expect(() => parseScenario(markdown)).toThrow(
      "Zest doesn't support lists yet."
    );
  });

  it('throws an error for ordered lists outside prose blocks', () => {
    const markdown = `
# Ordered list test

1. First
2. Second
`;
    expect(() => parseScenario(markdown)).toThrow(
      "Zest doesn't support lists yet."
    );
  });

  it('allows bullet lists inside <div class="prose">', () => {
    const markdown = `
# Prose test

<div class="prose">

- Item 1
- Item 2

</div>

\`expected fact\`
`;
    const parsed = parseScenario(markdown);
    expect(parsed.facts.length).toBe(1);
    expect(parsed.facts[0].asString()).toBe('expected fact');
  });
});
