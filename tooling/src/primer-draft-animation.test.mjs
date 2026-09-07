import test from 'node:test';
import assert from 'node:assert/strict';
import {draftAnimationMarkup,draftAnimationCSS} from './primer-draft-animation.mjs';

test('draft animation is self-contained with four packs and accessible controls',()=>{
  const html=draftAnimationMarkup();
  assert.equal((html.match(/data-player="/g)||[]).length,4);
  assert.equal((html.match(/data-pack="/g)||[]).length,4);
  assert.match(html,/Pick 1 card, pass the pack to the left/);
  for(const name of ['Play animation','Next pick','Restart animation']) assert.ok(html.includes('aria-label="'+name+'"'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(draftAnimationCSS.includes('prefers-reduced-motion'));
  assert.doesNotMatch(html,/<(?:iframe|video)|https?:\/\/[^" ]+\.(?:gif|mp4)/i);
});

test('editor-controlled animation heading is escaped, including script-like text',()=>{
  const heading='Oscar says <script>alert("test")</script> & draft';
  const html=draftAnimationMarkup(heading);
  assert.ok(html.includes('Oscar says &lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; draft'));
  assert.equal((html.match(/<script>/g)||[]).length,1,'Only the authored runtime script exists');
  assert.equal((html.match(/class="word"/g)||[]).length,5);
});

test('rendering animation is deterministic and has no draft-state dependency',()=>{
  assert.equal(draftAnimationMarkup(),draftAnimationMarkup());
});
