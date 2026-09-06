(() => {
  'use strict';
  const editor = document.querySelector('#editor');
  const status = document.querySelector('#status');
  const revisionLabel = document.querySelector('#revision');
  const saveButton = document.querySelector('#save');
  const publishButton = document.querySelector('#publish');
  const publicationStatus = document.querySelector('#publication-status');
  let publication = { state: 'idle' };
  let saving = false;
  const reloadButton = document.querySelector('#reload');
  const preview = document.querySelector('#preview');
  const dialog = document.querySelector('#printing-dialog');
  const searchForm = document.querySelector('#printing-search');
  const cardName = document.querySelector('#card-name');
  const results = document.querySelector('#printing-results');
  let content;
  let revision;
  let savedSnapshot;
  let cardTarget;

  const icon = name => {
    const image = document.createElement('img');
    image.src = `/assets/icons/${name}.svg`;
    image.alt = '';
    return image;
  };
  const imageFor = id => `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`;
  const setStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const dirty = () => JSON.stringify(content) !== savedSnapshot;
  const publishing = () => ['queued', 'running'].includes(publication.state);
  const syncControls = () => {
    publicationStatus.textContent = publication.state === 'complete'
      ? (dirty() || publication.sourceRevision !== revision ? 'Draft not published' : 'Live')
      : (publication.phase || '');
    editor.inert = saving || publishing();
    reloadButton.disabled = saving || publishing();
    saveButton.disabled = saving || publishing() || !content || !dirty();
    publishButton.disabled = saving || publishing() || !revision || dirty() || publication.state === 'unavailable';
  };
  const markDirty = () => {
    setStatus('Unsaved changes', 'dirty');
    syncControls();
  };
  async function refreshPublication() {
    try {
      const response = await fetch('/api/publish', { cache: 'no-store' });
      if (!response.ok) throw new Error('Publication status unavailable');
      publication = await response.json();
      publicationStatus.textContent = publication.state === 'idle' ? '' : (publication.phase || publication.state);
      publicationStatus.dataset.state = publication.state;
    } catch { publication = { state: 'unavailable', phase: 'Publication status unavailable' }; }
    syncControls();
  }
  publishButton.addEventListener('click', async () => {
    if (dirty() || publishing() || saving) return;
    publishButton.disabled = true;
    try {
      const response = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Publication could not start');
      publication = body;
      publicationStatus.textContent = body.phase;
    } catch (error) { publication = { state: 'failed', phase: error.message }; }
    syncControls();
  });
  const textField = (labelText, value, onInput, multiline = false) => {
    const label = document.createElement('label');
    label.append(labelText);
    const control = document.createElement(multiline ? 'textarea' : 'input');
    control.value = value;
    control.addEventListener('input', () => { onInput(control.value); markDirty(); });
    label.append(control);
    return label;
  };
  const actionButton = (iconName, label, action, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.append(icon(iconName));
    button.addEventListener('click', action);
    return button;
  };

  const groups = () => [
    ...content.sections.filter(section => section.id === 'removal' || section.id === 'blink')
      .map(section => ({ id: `section:${section.id}`, label: section.heading, cards: section.cards })),
    ...content.plans.map(plan => ({ id: `plan:${plan.id}`, label: `${plan.guild} · ${plan.name}`, cards: plan.cards })),
  ];
  const groupById = id => groups().find(group => group.id === id);

  function openPrinting(target) {
    cardTarget = target;
    results.replaceChildren();
    cardName.value = target.index === null ? '' : groupById(target.groupId).cards[target.index].name;
    dialog.showModal();
    requestAnimationFrame(() => cardName.focus());
  }

  function cardRow(group, card, index) {
    const row = document.createElement('div');
    row.className = 'edit-card';
    const art = document.createElement('img');
    art.src = imageFor(card.scryfallId);
    art.alt = '';
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = card.name;
    const printing = document.createElement('small');
    printing.textContent = `${card.set.toUpperCase()} · ${card.collectorNumber}`;
    copy.append(name, printing);
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.append(
      actionButton('arrow-up', `Move ${card.name} up`, () => {
        [group.cards[index - 1], group.cards[index]] = [group.cards[index], group.cards[index - 1]];
        markDirty(); render();
      }, index === 0),
      actionButton('arrow-down', `Move ${card.name} down`, () => {
        [group.cards[index], group.cards[index + 1]] = [group.cards[index + 1], group.cards[index]];
        markDirty(); render();
      }, index === group.cards.length - 1),
      actionButton('search', `Change ${card.name} or its printing`, () => openPrinting({ groupId: group.id, index })),
    );
    const destination = document.createElement('select');
    destination.title = `Move ${card.name} to another section`;
    destination.setAttribute('aria-label', `Move ${card.name} to another section`);
    for (const candidate of groups()) {
      const option = document.createElement('option');
      option.value = candidate.id;
      option.textContent = candidate.label;
      option.selected = candidate.id === group.id;
      destination.append(option);
    }
    destination.addEventListener('change', () => {
      const [moved] = group.cards.splice(index, 1);
      groupById(destination.value).cards.push(moved);
      markDirty(); render();
    });
    actions.append(destination, actionButton('trash-2', `Remove ${card.name}`, () => {
      group.cards.splice(index, 1);
      markDirty(); render();
    }));
    row.append(art, copy, actions);
    return row;
  }

  function cardEditor(groupId) {
    const group = groupById(groupId);
    const wrap = document.createElement('div');
    const list = document.createElement('div');
    list.className = 'card-list';
    group.cards.forEach((card, index) => list.append(cardRow(group, card, index)));
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'add-card';
    add.append(icon('plus'), 'Add card');
    add.addEventListener('click', () => openPrinting({ groupId, index: null }));
    wrap.append(list, add);
    return wrap;
  }

  function groupSection(title, subtitle = '') {
    const section = document.createElement('section');
    section.className = 'edit-group';
    const head = document.createElement('div');
    head.className = 'group-head';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const note = document.createElement('span');
    note.textContent = subtitle;
    head.append(heading, note);
    section.append(head);
    return section;
  }

  function render() {
    editor.replaceChildren();
    const hero = groupSection('Opening', '');
    const heroFields = document.createElement('div'); heroFields.className = 'field-grid';
    heroFields.append(
      textField('Eyebrow', content.hero.eyebrow, value => { content.hero.eyebrow = value; }),
      textField('Title', content.hero.title, value => { content.hero.title = value; }),
      textField('Lead', content.hero.lede, value => { content.hero.lede = value; }, true),
    );
    hero.append(heroFields); editor.append(hero);

    for (const sectionData of content.sections) {
      const section = groupSection(sectionData.heading, sectionData.eyebrow);
      const fields = document.createElement('div'); fields.className = 'field-grid two';
      fields.append(
        textField('Eyebrow', sectionData.eyebrow, value => { sectionData.eyebrow = value; }),
        textField('Heading', sectionData.heading, value => { sectionData.heading = value; }),
      );
      section.append(fields, textField('Paragraphs', sectionData.body.join('\n'), value => { sectionData.body = value.split('\n'); }, true));
      if (sectionData.id === 'removal' || sectionData.id === 'blink') section.append(cardEditor(`section:${sectionData.id}`));
      editor.append(section);
    }

    for (const plan of content.plans) {
      const section = groupSection(`${plan.guild} · ${plan.name}`, plan.id);
      const fields = document.createElement('div'); fields.className = 'field-grid two';
      fields.append(
        textField('Guild', plan.guild, value => { plan.guild = value; }),
        textField('Plan name', plan.name, value => { plan.name = value; }),
      );
      section.append(fields, textField('Teaching prompt', plan.body, value => { plan.body = value; }, true), cardEditor(`plan:${plan.id}`));
      editor.append(section);
    }

    const checklist = groupSection('Checklist', '');
    checklist.append(textField('Game-one checks', content.checklist.join('\n'), value => { content.checklist = value.split('\n'); }, true));
    editor.append(checklist);
    revisionLabel.textContent = revision ? `Revision ${revision.slice(0, 12)}` : '';
  }

  async function load() {
    setStatus('Loading saved source…', 'loading');
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (!response.ok) throw new Error((await response.json()).error || 'Load failed.');
    const body = await response.json();
    content = body.content;
    revision = body.revision;
    savedSnapshot = JSON.stringify(content);
    render();
    saveButton.disabled = true;
    setStatus('Draft saved', 'saved');
    syncControls();
  }

  saveButton.addEventListener('click', async () => {
    if (saving || publishing()) return;
    saving = true;
    syncControls();
    setStatus('Validating and rebuilding…', 'loading');
    try {
      const response = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision, content }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Save failed.');
      content = body.content;
      revision = body.revision;
      savedSnapshot = JSON.stringify(content);
      render();
      revisionLabel.textContent = `Revision ${revision.slice(0, 12)}`;
      preview.src = `/preview/draft-primer.html?revision=${revision}`;
      setStatus('Draft saved', 'saved');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      saving = false;
      syncControls();
    }
  });

  reloadButton.addEventListener('click', () => {
    if (!dirty() || confirm('Discard unsaved changes and reload?')) load().catch(error => setStatus(error.message, 'error'));
  });

  searchForm.addEventListener('submit', async event => {
    event.preventDefault();
    results.textContent = 'Checking Scryfall…';
    try {
      const response = await fetch(`/api/scryfall?name=${encodeURIComponent(cardName.value)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Scryfall lookup failed.');
      results.replaceChildren();
      if (!body.printings.length) { results.textContent = 'No readable English paper printings found.'; return; }
      for (const printing of body.printings) {
        const row = document.createElement('article'); row.className = 'printing';
        const art = document.createElement('img'); art.src = printing.image; art.alt = printing.name;
        const copy = document.createElement('div'); copy.className = 'printing-copy';
        const heading = document.createElement('h3'); heading.textContent = `${printing.name} · ${printing.set.toUpperCase()} ${printing.collectorNumber}`;
        const release = document.createElement('span'); release.className = printing.recommended ? 'recommended' : 'hint';
        release.textContent = `${printing.releasedAt}${printing.recommended ? ' · standard readable frame' : ''}`;
        const rules = document.createElement('p'); rules.textContent = printing.oracleText;
        const choose = document.createElement('button'); choose.type = 'button'; choose.textContent = 'Use this printing';
        choose.addEventListener('click', () => {
          const selected = { scryfallId: printing.scryfallId, name: printing.name, set: printing.set, collectorNumber: printing.collectorNumber };
          const group = groupById(cardTarget.groupId);
          if (cardTarget.index === null) group.cards.push(selected); else group.cards[cardTarget.index] = selected;
          markDirty(); render(); dialog.close();
        });
        copy.append(heading, release, rules, choose); row.append(art, copy); results.append(row);
      }
    } catch (error) { results.textContent = error.message; }
  });

  window.addEventListener('beforeunload', event => {
    if (!dirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  load().then(refreshPublication).catch(error => setStatus(error.message, 'error'));
  setInterval(refreshPublication, 5000);
})();
