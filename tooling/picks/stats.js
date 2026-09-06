(() => {
 const $ = selector => document.querySelector(selector);
 let rows = [];
 function render() {
  const pack = $('#pack').value, experience = $('#experience').value, version = $('#version').value;
  const counts = new Map(); let first = 0, last = 0;
  for (const row of rows) {
   if (pack && row.pack !== Number(pack) || experience !== '' && row.experience !== Number(experience) || version && row.cubeVersion !== Number(version)) continue;
   const item = counts.get(row.card) || { name: row.card, first: 0, last: 0 };
   item[row.kind] += row.count; counts.set(row.card, item);
   if (row.kind === 'first') first += row.count; else last += row.count;
  }
  $('#totals').textContent = first + ' first picks · ' + last + ' last cards';
  const order = $('#order').value, search = $('#search').value.toLowerCase();
  const shown = [...counts.values()].filter(item => item.name.toLowerCase().includes(search)).sort((a,b) => (order === 'name' ? 0 : b[order] - a[order]) || a.name.localeCompare(b.name));
  $('#rows').replaceChildren();
  for (const item of shown) {
   const tr = document.createElement('tr');
   for (const value of [item.name, item.first, item.last]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
   $('#rows').append(tr);
  }
  $('#empty').hidden = shown.length > 0;
  $('#empty').textContent = rows.length ? 'No matching reports.' : 'No reports yet.';
 }
 async function load() {
  $('#refresh').disabled = true;
  try {
   const response = await fetch('/api/draft-stats', { cache: 'no-store' });
   if (!response.ok) throw new Error();
   rows = (await response.json()).rows;
   const previous = $('#version').value; $('#version').replaceChildren(new Option('All versions', ''));
   [...new Set(rows.map(row => row.cubeVersion))].sort((a,b) => b-a).forEach(value => $('#version').add(new Option(String(value), String(value))));
   if ([...$('#version').options].some(option => option.value === previous)) $('#version').value = previous;
   render();
  } catch { $('#totals').textContent = 'Reports could not load. Refresh to retry.'; }
  finally { $('#refresh').disabled = false; }
 }
 ['pack','experience','version','order'].forEach(id => $('#' + id).addEventListener('change', render));
 $('#search').addEventListener('input', render); $('#refresh').addEventListener('click', load); load();
})();
