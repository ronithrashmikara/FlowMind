import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJson } from '../src/lib/server/llm.ts';

test('parseJson keeps LaTeX commands that would otherwise become control characters', () => {
  const raw = '{"answer":"use $\\frac{\\partial L}{\\partial w}$ and $a \\times b$"}';
  assert.deepEqual(parseJson(raw), { answer: 'use $\\frac{\\partial L}{\\partial w}$ and $a \\times b$' });
});

test('parseJson leaves correctly escaped LaTeX and real newlines alone', () => {
  const raw = '{"answer":"line one\\nline two $\\\\eta$"}';
  assert.deepEqual(parseJson(raw), { answer: 'line one\nline two $\\eta$' });
});

test('parseJson extracts JSON wrapped in prose or code fences', () => {
  assert.deepEqual(parseJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.deepEqual(parseJson('Here you go: {"ok": 1} hope it helps'), { ok: 1 });
});

test('parseJson escapes stray backslashes as a last resort', () => {
  assert.deepEqual(parseJson('{"a":"C:\\Users\\q"}'), { a: 'C:\\Users\\q' });
});
