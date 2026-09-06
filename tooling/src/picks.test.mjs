import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
test('anonymous pick storage and HTTP boundary: seven Python integration cases', () => {
 const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'picks', '-p', 'test_*.py'], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, timeout: 30000 });
 assert.equal(result.status, 0, result.stdout + result.stderr);
});
