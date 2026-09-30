import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMath, prepareMarkdown } from '../src/lib/markdown.ts';

test('normalizeMath converts \\( \\) and \\[ \\] delimiters to dollar math', () => {
  assert.equal(normalizeMath('so \\(z = w x + b\\) holds'), 'so $z = w x + b$ holds');
  assert.equal(normalizeMath('\\[\\frac{a}{b}\\]'), '$$\\frac{a}{b}$$');
});

test('prepareMarkdown turns citation groups into cite links', () => {
  assert.equal(prepareMarkdown('Fact [1, 3].'), 'Fact [1](#cite-1)[3](#cite-3).');
  assert.equal(prepareMarkdown('See [2][4]'), 'See [2](#cite-2)[4](#cite-4)');
  assert.equal(prepareMarkdown('an [array] stays'), 'an [array] stays');
});
