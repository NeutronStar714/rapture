import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotePersistence } from '../src/utils/notePersistence.ts';
const note = text => ({ id: '1', pageNumber: 1, yPercent: 0.4, text, timestamp: 1 });
function session(write, storageOverride) {
  const values = new Map();
  const errors = [];
  const storage = storageOverride ?? { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return { manager: new NotePersistence(write, storage, () => {}, e => errors.push(e)), values, errors };
}
test('immediate edit then close preserves the final keystroke', async () => {
  const writes = [];
  const { manager, values } = session(async (name, notes) => writes.push([name, notes]));
  await manager.activate('a.pdf');
  manager.update([note('last character')]);
  assert.equal(JSON.parse(values.get('rapture_eyeliner_a.pdf'))[0].text, 'last character');
  await manager.activate('');
  assert.equal(writes[0][1][0].text, 'last character');
});
test('updates during a slow save are serialized; deleting last note writes an empty array', async () => {
  const writes = [];
  let release;
  let entered;
  const started = new Promise(resolve => entered = resolve);
  const { manager } = session(async (name, notes) => {
    writes.push(notes);
    if (writes.length === 1) { entered(); await new Promise(resolve => release = resolve); }
  });
  await manager.activate('a.pdf');
  manager.update([note('old')]);
  const saving = manager.flush();
  await started;
  manager.update([]);
  const closing = manager.flush();
  assert.equal(writes.length, 1);
  release();
  await Promise.all([saving, closing]);
  assert.deepEqual(writes, [[note('old')], []]);
  assert.equal(manager.pending, false);
});
test('failed save blocks switching and can be retried without poisoning the queue', async () => {
  let fail = true;
  const { manager, errors } = session(async () => { if (fail) throw Error('disk full'); });
  await manager.activate('a.pdf');
  manager.update([note('recover me')]);
  await assert.rejects(manager.activate('b.pdf'), /disk full/);
  assert.equal(manager.fileName, 'a.pdf');
  assert.equal(manager.pending, true);
  assert.match(errors.at(-1), /disk full/);
  fail = false;
  await manager.activate('b.pdf');
  assert.equal(manager.fileName, 'b.pdf');
  assert.deepEqual(manager.notes, []);
});
test('switching documents never writes previous notes to the next document', async () => {
  const writes = [];
  const { manager, values } = session(async (name, notes) => writes.push([name, notes]));
  values.set('rapture_eyeliner_b.pdf', JSON.stringify([note('B')]));
  await manager.activate('a.pdf');
  manager.update([note('A')]);
  await manager.activate('b.pdf');
  await manager.flush();
  assert.deepEqual(writes, [['a.pdf', [note('A')]]]);
  assert.equal(manager.notes[0].text, 'B');
});
test('local storage failure still permits disk recovery and remains visible', async () => {
  const writes = [];
  const { manager, errors } = session(async (_, notes) => writes.push(notes), {getItem: () => null, setItem: () => { throw Error('quota'); }});
  await manager.activate('a.pdf');
  manager.update([note('backup')]);
  await assert.rejects(manager.flush(), /local recovery failed/);
  assert.equal(writes[0][0].text, 'backup');
  assert.match(errors.at(-1), /quota/);
});
