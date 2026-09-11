import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveLeaderParent, planLeaderMove, planLeaderReorder, reorderLeaderSlugs, type LeaderTreeRow } from './k12-leader-tree.ts';

const row = (id: number, slug: string, parent_id: number | null = null): LeaderTreeRow =>
  ({ id, slug, relative_path: `${slug}.md`, parent_id, section_id: null, type: 'article', sort_order: 0 });
const rows = [row(1, 'iv'), row(2, 'v'), row(3, 'iv/a', 1), row(4, 'iv/a/child', 3), row(5, 'iv/b', 1)];

test('dragging a sibling down one position changes the order', () => {
  assert.deepEqual(reorderLeaderSlugs(['a', 'b', 'c'], 'a', 'b'), ['b', 'a', 'c']);
  assert.deepEqual(reorderLeaderSlugs(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
});
test('reorder requires the complete current sibling set', () => {
  assert.deepEqual(planLeaderReorder(rows, 'iv', ['iv/b', 'iv/a']).map(r => [r.id, r.sort_order]), [[5, 0], [3, 1]]);
  assert.throws(() => planLeaderReorder(rows, 'iv', ['iv/a']));
  assert.throws(() => planLeaderReorder(rows, 'iv', ['iv/a', 'iv/a']));
  assert.throws(() => planLeaderReorder(rows, 'missing', ['iv']));
  assert.throws(() => planLeaderReorder(rows, 'iv', ['iv/a', 'v']));
});
test('legacy paths with no parent_id participate in sibling ordering', () => {
  const legacy = [row(1, 'iv'), row(2, 'iv/a'), row(3, 'iv/b')];
  assert.equal(effectiveLeaderParent(legacy, legacy[1]), 1);
  assert.equal(planLeaderReorder(legacy, 'iv', ['iv/b', 'iv/a']).length, 2);
});
test('moving a subtree changes every path and preserves child identity', () => {
  const moved = planLeaderMove(rows, 'iv/a', 'v/a', 'v', 2);
  assert.deepEqual(moved.map(r => [r.id, r.slug, r.relative_path, r.parent_id]),
    [[3, 'v/a', 'v/a.md', 2], [4, 'v/a/child', 'v/a/child.md', 3]]);
  assert.equal(moved[0].sort_order, 2);
  assert.equal(rows[2].slug, 'iv/a');
});
test('moving to the root removes parent and section', () => {
  const moved = planLeaderMove(rows, 'iv/a', 'a', null);
  assert.equal(moved[0].parent_id, null);
  assert.equal(moved[0].section_id, null);
  assert.equal(moved[1].slug, 'a/child');
});
test('reject cycles, invalid destination and collisions anywhere in the subtree', () => {
  assert.throws(() => planLeaderMove(rows, 'iv/a', 'iv/a/child/a', 'iv/a/child'));
  assert.throws(() => planLeaderMove(rows, 'iv/a', 'v/a', 'iv'));
  assert.throws(() => planLeaderMove(rows, 'iv/a', 'iv/b', 'iv'));
  assert.throws(() => planLeaderMove([...rows, row(6, 'v/a/child', 2)], 'iv/a', 'v/a', 'v'));
});
test('preserves index landing paths and updates section ancestry', () => {
  const fixture = rows.map(r => r.id === 2 ? { ...r, type: 'section' as const, relative_path: 'v/index.md' } : r);
  const moved = planLeaderMove(fixture, 'iv/a', 'v/a', 'v');
  assert.equal(moved[0].section_id, 2);
  assert.equal(moved[1].section_id, 2);
  assert.equal(planLeaderMove(fixture, 'v', 'vi', null)[0].relative_path, 'vi/index.md');
});
