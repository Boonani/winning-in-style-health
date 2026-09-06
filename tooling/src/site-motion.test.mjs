import assert from 'node:assert/strict';
import test from 'node:test';
import { siteMotionCSS, siteMotionScript } from './site-motion.mjs';

test('motion is progressive and reduced-motion safe', () => {
  assert.match(siteMotionCSS, /\[data-motion\] \{ opacity: 1; transform: none; \}/);
  assert.match(siteMotionCSS, /prefers-reduced-motion: reduce/);
  assert.match(siteMotionCSS, /opacity: 1 !important; transform: none !important/);
  assert.match(siteMotionScript, /if \(reduced\.matches \|\| !\('IntersectionObserver' in window\)\) return/);
});

test('edge fades and interruption-safe details are explicitly guarded', () => {
  assert.match(siteMotionScript, /rect\.bottom <= edge \|\| rect\.top >= innerHeight - edge/);
  assert.match(siteMotionScript, /running\?\.cancel\(\)/);
  assert.match(siteMotionScript, /event\.target\.closest\('summary'\)/);
  assert.match(siteMotionScript, /details\.open = opening/);
});
