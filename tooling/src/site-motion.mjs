export const siteMotionCSS = String.raw`
  [data-motion] { opacity: 1; transform: none; }
  .motion-ready [data-motion].motion-away {
    opacity: 0;
    transform: translateY(var(--motion-offset, 12px));
  }
  .motion-ready [data-motion].motion-visible {
    opacity: 1;
    transform: none;
  }
  .motion-ready [data-motion] {
    transition: opacity 440ms cubic-bezier(.22,1,.36,1), transform 520ms cubic-bezier(.22,1,.36,1);
  }
  [data-motion-bar] { transform: scaleY(1); transform-origin: bottom; }
  .motion-ready [data-motion-bar].motion-away { transform: scaleY(0); }
  .motion-ready [data-motion-bar].motion-visible { transform: scaleY(1); }
  .motion-ready [data-motion-bar] { transition: transform 620ms cubic-bezier(.16,1,.3,1); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      scroll-behavior: auto !important;
      animation-duration: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
    }
    [data-motion], [data-motion-bar] { opacity: 1 !important; transform: none !important; }
  }
`;

export const siteMotionScript = String.raw`
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion-ready');

  const edge = 8;
  const observed = new WeakSet();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target;
      if (entry.isIntersecting) {
        element.classList.remove('motion-away');
        element.classList.add('motion-visible');
        continue;
      }
      const rect = entry.boundingClientRect;
      if (rect.bottom <= edge || rect.top >= innerHeight - edge) {
        element.style.setProperty('--motion-offset', rect.bottom <= edge ? '-4px' : '12px');
        element.classList.remove('motion-visible');
        element.classList.add('motion-away');
      }
    }
  }, { threshold: [0, .08, .7], rootMargin: '-8px 0px -8px 0px' });

  const observe = root => {
    for (const element of root.querySelectorAll?.('[data-motion], [data-motion-bar]') ?? []) {
      if (observed.has(element)) continue;
      observed.add(element);
      const rect = element.getBoundingClientRect();
      if (rect.top >= innerHeight - edge) element.classList.add('motion-away');
      else element.classList.add('motion-visible');
      observer.observe(element);
    }
  };
  observe(document);
  new MutationObserver(records => records.forEach(record => {
    record.removedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      for (const element of [node, ...node.querySelectorAll('[data-motion], [data-motion-bar]')]) {
        observer.unobserve(element);
        observed.delete(element);
      }
    });
    record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches?.('[data-motion], [data-motion-bar]')) observe(node.parentElement ?? document);
      else observe(node);
    });
  })).observe(document.body, { childList: true, subtree: true });

  const animations = new WeakMap();
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.querySelectorAll('details').forEach(details => animations.get(details)?.finish());
  });
  document.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    const details = summary?.parentElement;
    if (!summary || details?.tagName !== 'DETAILS' || reduced.matches) return;
    event.preventDefault();

    const running = animations.get(details);
    const currentlyOpening = details.dataset.motionOpening === 'true';
    const opening = !(currentlyOpening || (details.open && details.dataset.motionClosing !== 'true'));
    const start = details.getBoundingClientRect().height;
    running?.cancel();
    details.style.height = start + 'px';
    details.style.overflow = 'clip';
    details.open = true;
    details.dataset.motionOpening = String(opening);
    details.dataset.motionClosing = String(!opening);
    const end = opening ? details.scrollHeight : summary.getBoundingClientRect().height;
    const animation = details.animate(
      { height: [start + 'px', end + 'px'] },
      { duration: opening ? 360 : 280, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    animations.set(details, animation);
    animation.onfinish = () => {
      if (animations.get(details) !== animation) return;
      details.open = opening;
      details.style.height = '';
      details.style.overflow = '';
      delete details.dataset.motionOpening;
      delete details.dataset.motionClosing;
      animations.delete(details);
    };
    animation.oncancel = () => {
      if (animations.get(details) === animation) animations.delete(details);
    };
  }, true);
})();
`;

export function siteMotionMarkup() {
  return `<script>${siteMotionScript.replaceAll('</script', '<\\/script')}</script>`;
}
