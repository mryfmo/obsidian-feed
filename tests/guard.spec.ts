import { execSync } from 'node:child_process';
import { expect, test, describe } from 'vitest';
import * as fs from 'node:fs';

function run(file: string) {
  try {
    execSync(`bash tools/turn_guard.sh ${file}`, { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? 1;
  }
}

describe('guard tests', () => {
  for (const f of ['valid_turn', 'invalid_phase', 'loc_over', 'network_non_fetch', 'dup_sha']) {
    const exp = f === 'valid_turn' ? 0 : 1;
    test(`${f}`, () => {
      expect(run(`tests/fixtures/${f}.md`)).toBe(exp);
    });
  }
  const table = fs
    .readFileSync('tests/spec.yml', 'utf-8')
    .trim()
    .split('\n')
    .slice(1)
    .map(l => l.split(','));

  describe('guard-table', () => {
    table.forEach(([id, , fixture, exp]) => {
      test(id, () => {
        expect(run(fixture)).toBe(exp === 'pass' ? 0 : 1);
      });
    });
  });
});

test('valid turn passes guard', () => {
  const code = run('tests/fixtures/valid_turn.md');
  expect(code).toBe(0);
});

test('invalid phase tag fails', () => {
  const code = run('tests/fixtures/invalid_phase.md');
  expect(code).not.toBe(0);
});

test('LOC over limit fails', () => {
  const exitCode = run('tests/fixtures/loc_over.md');
  expect(exitCode).not.toBe(0);
});

test('network outside FETCH fails', () => {
  const code = run('tests/fixtures/network_non_fetch.md');
  expect(code).not.toBe(0);
});

test('duplicate SHA in FETCH fails', () => {
  const code = run('tests/fixtures/dup_sha.md');
  expect(code).not.toBe(0);
});

test('token short fails', () => {
  expect(run('tests/fixtures/token_short.md')).not.toBe(0);
});
test('token long fails', () => {
  expect(run('tests/fixtures/token_long.md')).not.toBe(0);
});
