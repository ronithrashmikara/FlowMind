import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkSegment } from '../src/lib/parse.ts';
import { bm25, coverage, retrieve } from '../src/lib/retrieval.ts';
import { emptyWorkspace, type Workspace } from '../src/lib/types.ts';

const chunk = (id: string, text: string) => ({ id, sourceId: 's', filename: 'lecture.pdf', locator: `p. ${id}`, text });

function workspace(): Workspace {
  return {
    ...emptyWorkspace(),
    chunks: [
      chunk('1', 'The chain rule from calculus lets us differentiate composed functions.'),
      chunk('2', 'Backpropagation computes gradients of the loss for every weight in one backward pass.'),
      chunk('3', 'Dropout randomly disables neurons during training to reduce overfitting.'),
      chunk('4', 'Softmax converts logits into a probability distribution over classes.'),
    ],
    concepts: [
      { id: 'chain', name: 'Chain Rule', definition: 'Differentiates composed functions.', kind: 'concept', importance: 4, chunkIds: ['1'] },
      { id: 'backprop', name: 'Backpropagation', definition: 'Computes gradients.', kind: 'concept', importance: 5, chunkIds: ['2'] },
      { id: 'dropout', name: 'Dropout', definition: 'Regularisation.', kind: 'detail', importance: 3, chunkIds: ['3'] },
    ],
    relations: [{ id: 'r1', source: 'chain', target: 'backprop', type: 'prerequisite_of' }],
  };
}

test('bm25 ranks the passage that shares rare query terms first', () => {
  const scores = bm25(workspace().chunks, 'how does dropout reduce overfitting');
  const best = [...scores].sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(best, '3');
});

test('retrieve expands the context with passages for prerequisite concepts', () => {
  const ws = workspace();
  const { passages, concepts } = retrieve(ws, 'explain backpropagation', null, 3);
  assert.equal(passages[0].id, '2');
  assert.ok(passages.some((p) => p.id === '1'), 'chain rule passage pulled in through the prerequisite edge');
  assert.deepEqual(concepts.map((c) => c.id).sort(), ['backprop', 'chain']);
});

test('retrieve blends semantic scores when embeddings exist', () => {
  const ws = workspace();
  ws.chunks.forEach((c, i) => (c.embedding = [i === 3 ? 1 : 0, i === 3 ? 0 : 1]));
  const { passages } = retrieve(ws, 'which function outputs class probabilities', [1, 0], 2);
  assert.equal(passages[0].id, '4');
});

test('chunkSegment splits long text into overlapping passages near the target size', () => {
  const sentence = 'Gradient descent updates each weight in the direction that lowers the loss. ';
  const pieces = chunkSegment(sentence.repeat(60));
  assert.ok(pieces.length > 3);
  for (const piece of pieces) assert.ok(piece.length <= 1200, `piece too long: ${piece.length}`);
  assert.equal(chunkSegment('short text').length, 1);
  assert.equal(chunkSegment('   ').length, 0);
});

test('coverage returns ordered, unique passages including focus ids', () => {
  const ws = workspace();
  const picked = coverage(ws, 3, ['4']);
  assert.equal(new Set(picked.map((c) => c.id)).size, picked.length);
  assert.ok(picked.some((c) => c.id === '4'));
  const order = picked.map((c) => Number(c.id));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});
