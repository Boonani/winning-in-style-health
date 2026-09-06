(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const form = $('#form'), card = $('#card'), matches = $('#matches'), status = $('#status');
  const submit = $('#submit'), experience = $('#experience'), preview = $('#preview');
  let kind = new URL(location.href).searchParams.get('pick') === 'first' ? 'first' : 'last';
  let catalog = [], selected = null, results = [], active = -1, busy = false, pending = null;
  const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const showKind = () => {
    $('#question').textContent = kind === 'first' ? 'What was your first pick?' : 'What is the last card in the pack?';
    document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
  };
  const close = () => { matches.hidden = true; card.setAttribute('aria-expanded', 'false'); card.removeAttribute('aria-activedescendant'); active = -1; };
  const remember = value => { try { if (value) sessionStorage.setItem('cube-pending-pick', JSON.stringify(value)); else sessionStorage.removeItem('cube-pending-pick'); } catch {} };
  const changed = () => { if (!busy) { pending = null; remember(null); } };
  const choose = item => {
    selected = item; card.value = item.name; $('#selection').textContent = item.name; close();
    preview.hidden = false; preview.open = false; $('#art').removeAttribute('src'); $('#art').alt = item.name;
    changed();
  };
  const renderMatches = () => {
    selected = null; preview.hidden = true; $('#selection').textContent = ''; changed();
    const query = fold(card.value.trim());
    results = query ? catalog.filter(item => fold(item.name).includes(query)).sort((a,b) => Number(fold(b.name).startsWith(query))-Number(fold(a.name).startsWith(query))).slice(0, 12) : [];
    matches.replaceChildren(); active = -1;
    for (const [index, item] of results.entries()) {
      const option = document.createElement('li'); option.id = 'match-' + index;
      option.role = 'option'; option.setAttribute('aria-selected', 'false'); option.textContent = item.name;
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(item)); matches.append(option);
    }
    matches.hidden = !results.length; card.setAttribute('aria-expanded', String(Boolean(results.length)));
    if (query && !results.length) $('#selection').textContent = 'No matching card.';
  };
  card.addEventListener('input', renderMatches);
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') return close();
    if (['ArrowDown','ArrowUp'].includes(event.key) && results.length) {
      event.preventDefault(); matches.hidden = false; card.setAttribute('aria-expanded', 'true');
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      [...matches.children].forEach((el,i) => el.setAttribute('aria-selected', String(i === active)));
      card.setAttribute('aria-activedescendant', 'match-' + active); matches.children[active].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && !matches.hidden && active >= 0) {
      event.preventDefault(); choose(results[active]);
    }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.search')) close(); });
  document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
    if (busy) return;
    kind = button.dataset.kind; changed(); showKind();
  }));
  form.addEventListener('change', changed);
  preview.addEventListener('toggle', () => { if (preview.open && selected) $('#art').src = selected.image; });
  function setBusy(value) {
    busy = value; form.inert = value;
    document.querySelectorAll('[data-kind]').forEach(button => button.disabled = value);
    submit.disabled = value || !catalog.length;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!selected || selected.name !== card.value) { status.textContent = 'Choose a matching card.'; card.focus(); return; }
    const pack = form.querySelector('[name="pack"]:checked');
    if (!pack || experience.value === '') { status.textContent = 'Choose pack and experience.'; return; }
    if (!pending) pending = { submissionId: crypto.randomUUID(), card: selected.name, kind, pack: Number(pack.value), experience: Number(experience.value) };
    remember(pending); setBusy(true); status.textContent = 'Saving...';
    try {
      const response = await fetch('/api/picks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending), signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok || !body.saved) throw new Error(body.error || 'Not saved yet. Please retry.');
      pending = null; remember(null); form.hidden = true; preview.hidden = true; $('#success').hidden = false; status.textContent = '';
      $('#another').focus();
    } catch (error) { status.textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Connection lost. Retry to confirm this pick.' : error.message; }
    finally { setBusy(false); }
  });
  $('#another').addEventListener('click', () => {
    selected = null; card.value = ''; $('#selection').textContent = ''; preview.hidden = true; close();
    $('#success').hidden = true; form.hidden = false; card.focus();
  });
  showKind();
  fetch('/cards.json', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error();
    catalog = (await response.json()).cards; card.disabled = false; submit.disabled = false; status.textContent = '';
    let recovered;
    try { recovered = JSON.parse(sessionStorage.getItem('cube-pending-pick')); } catch {}
    if (recovered && catalog.some(item => item.name === recovered.card) && [1,2,3].includes(recovered.pack) && Number.isInteger(recovered.experience) && recovered.experience >= 0 && recovered.experience <= 5 && ['first','last'].includes(recovered.kind)) {
      choose(catalog.find(item => item.name === recovered.card)); kind = recovered.kind; showKind();
      form.querySelector('[name="pack"][value="' + recovered.pack + '"]').checked = true; experience.value = String(recovered.experience);
      pending = recovered; remember(pending); status.textContent = 'A pick needs confirmation. Retry to confirm.';
    }
  }).catch(() => { status.textContent = 'Cards could not load. Reload to retry.'; });
})();
