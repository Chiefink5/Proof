const STORAGE_KEY = 'choreLoggerV1';

const seedState = {
  settings: { collapseByDefault: false },
  groups: [
    { id: crypto.randomUUID(), name: 'Kitchen', archived: false, sortOrder: 1, subChores: [
      { id: crypto.randomUUID(), name: 'Dishes', archived: false, sortOrder: 1 },
      { id: crypto.randomUUID(), name: 'Trash', archived: false, sortOrder: 2 },
      { id: crypto.randomUUID(), name: 'Counters', archived: false, sortOrder: 3 },
    ]},
    { id: crypto.randomUUID(), name: 'Bathroom', archived: false, sortOrder: 2, subChores: [
      { id: crypto.randomUUID(), name: 'Toilet', archived: false, sortOrder: 1 },
      { id: crypto.randomUUID(), name: 'Sink', archived: false, sortOrder: 2 },
      { id: crypto.randomUUID(), name: 'Mirror', archived: false, sortOrder: 3 },
    ]},
  ],
  logs: [],
};

let state = loadState();

const els = {
  tabs: [...document.querySelectorAll('.tab')],
  views: [...document.querySelectorAll('.view')],
  groupsContainer: document.getElementById('groupsContainer'),
  manageGroupsContainer: document.getElementById('manageGroupsContainer'),
  logContainer: document.getElementById('logContainer'),
  addGroupBtn: document.getElementById('addGroupBtn'),
  newGroupName: document.getElementById('newGroupName'),
  todayCount: document.getElementById('todayCount'),
  weekCount: document.getElementById('weekCount'),
  streakCount: document.getElementById('streakCount'),
  manualDialog: document.getElementById('manualDialog'),
  manualForm: document.getElementById('manualForm'),
  manualTitle: document.getElementById('manualTitle'),
  manualGroup: document.getElementById('manualGroup'),
  manualSubChore: document.getElementById('manualSubChore'),
  manualAction: document.getElementById('manualAction'),
  manualAmount: document.getElementById('manualAmount'),
  manualDate: document.getElementById('manualDate'),
  manualTime: document.getElementById('manualTime'),
  manualNote: document.getElementById('manualNote'),
  editingLogId: document.getElementById('editingLogId'),
  openManualBtn: document.getElementById('openManualBtn'),
  filterGroup: document.getElementById('filterGroup'),
  searchLog: document.getElementById('searchLog'),
  filterFrom: document.getElementById('filterFrom'),
  filterTo: document.getElementById('filterTo'),
  collapseByDefault: document.getElementById('collapseByDefault'),
  seedDataBtn: document.getElementById('seedDataBtn'),
  resetDataBtn: document.getElementById('resetDataBtn'),
};

boot();

function boot() {
  bindEvents();
  hydrateManualDefaults();
  renderAll();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindEvents() {
  els.tabs.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  els.addGroupBtn.addEventListener('click', addGroup);
  els.openManualBtn.addEventListener('click', () => openManualDialog());
  els.manualGroup.addEventListener('change', syncManualSubChores);
  els.manualForm.addEventListener('submit', saveManualEntry);
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => els.manualDialog.close()));
  els.searchLog.addEventListener('input', renderLogView);
  els.filterGroup.addEventListener('change', renderLogView);
  els.filterFrom.addEventListener('input', renderLogView);
  els.filterTo.addEventListener('input', renderLogView);
  els.collapseByDefault.addEventListener('change', () => {
    state.settings.collapseByDefault = els.collapseByDefault.checked;
    saveState(); renderHomeView();
  });
  els.seedDataBtn.addEventListener('click', () => {
    if (!confirm('Load demo data into the app?')) return;
    state = structuredClone(seedState);
    const firstGroup = state.groups[0];
    const firstSub = firstGroup.subChores[0];
    addLog({ groupId: firstGroup.id, subChoreId: firstSub.id, actionType: 'plus', amount: 1, effectiveDate: todayString(), effectiveTime: nowTimeString(), note: 'Demo log entry', isManualEntry: false });
    saveState(); renderAll();
  });
  els.resetDataBtn.addEventListener('click', () => {
    if (!confirm('Wipe all groups, sub-chores, and logs?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState(true);
    renderAll();
  });
}

function loadState(forceBlank = false) {
  if (forceBlank) return { settings: { collapseByDefault: false }, groups: [], logs: [] };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    const parsed = JSON.parse(raw);
    parsed.settings ||= { collapseByDefault: false };
    parsed.groups ||= [];
    parsed.logs ||= [];
    return parsed;
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  saveState();
  renderHomeView();
  renderManageView();
  renderLogFilters();
  renderLogView();
  renderStats();
  els.collapseByDefault.checked = !!state.settings.collapseByDefault;
}

function switchView(id) {
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === id));
  els.views.forEach(view => view.classList.toggle('active', view.id === id));
}

function renderHomeView() {
  els.groupsContainer.innerHTML = '';
  const activeGroups = sortedGroups();
  if (!activeGroups.length) {
    els.groupsContainer.innerHTML = `<div class="empty">No groups yet. Add one in Manage.</div>`;
    return;
  }
  const tpl = document.getElementById('groupCardTemplate');
  activeGroups.forEach(group => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.groupId = group.id;
    if (state.settings.collapseByDefault) node.classList.add('collapsed');
    node.querySelector('.group-name').textContent = group.name;
    node.querySelector('.group-meta').textContent = `${group.subChores.filter(s => !s.archived).length} sub-chores`;
    const toggleBtn = node.querySelector('.toggle-group');
    toggleBtn.addEventListener('click', () => node.classList.toggle('collapsed'));

    const subList = node.querySelector('.sub-list');
    const activeSubs = sortedSubs(group);
    if (!activeSubs.length) {
      subList.innerHTML = `<div class="empty">No sub-chores in this group yet.</div>`;
    } else {
      activeSubs.forEach(sub => {
        const last = getLastLog(group.id, sub.id);
        const row = document.createElement('div');
        row.className = 'sub-row';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(sub.name)}</strong>
            <p class="muted small">${last ? `Last: ${formatEffective(last)}` : 'No logs yet'}</p>
          </div>
          <div class="sub-actions">
            <button class="action-btn minus" aria-label="Log minus">−</button>
            <button class="action-btn plus" aria-label="Log plus">+</button>
            <button class="mini-btn">Manual</button>
          </div>
        `;
        row.querySelector('.plus').addEventListener('click', () => quickLog(group.id, sub.id, 'plus'));
        row.querySelector('.minus').addEventListener('click', () => quickLog(group.id, sub.id, 'minus'));
        row.querySelector('.mini-btn').addEventListener('click', () => openManualDialog({ groupId: group.id, subChoreId: sub.id }));
        subList.appendChild(row);
      });
    }
    els.groupsContainer.appendChild(node);
  });
}

function renderManageView() {
  els.manageGroupsContainer.innerHTML = '';
  const groups = sortedGroups();
  if (!groups.length) {
    els.manageGroupsContainer.innerHTML = `<div class="empty">No groups yet. Add one above.</div>`;
    return;
  }
  const tpl = document.getElementById('manageGroupTemplate');
  groups.forEach(group => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const groupInput = node.querySelector('.group-name-input');
    groupInput.value = group.name;
    groupInput.addEventListener('change', () => {
      group.name = groupInput.value.trim() || group.name;
      renderAll();
    });
    node.querySelector('.delete-group-btn').addEventListener('click', () => deleteGroup(group.id));

    const subWrap = node.querySelector('.manage-sub-list');
    sortedSubs(group).forEach(sub => {
      const row = document.createElement('div');
      row.className = 'toolbar';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(sub.name)}" />
        <div class="sub-actions">
          <button class="mini-btn up-btn">↑</button>
          <button class="mini-btn down-btn">↓</button>
          <button class="danger-btn delete-sub-btn">Delete</button>
        </div>
      `;
      const [input] = row.querySelectorAll('input');
      input.addEventListener('change', () => {
        sub.name = input.value.trim() || sub.name;
        renderAll();
      });
      row.querySelector('.delete-sub-btn').addEventListener('click', () => deleteSub(group.id, sub.id));
      row.querySelector('.up-btn').addEventListener('click', () => moveSub(group.id, sub.id, -1));
      row.querySelector('.down-btn').addEventListener('click', () => moveSub(group.id, sub.id, 1));
      subWrap.appendChild(row);
    });

    const newSubInput = node.querySelector('.new-sub-input');
    node.querySelector('.add-sub-btn').addEventListener('click', () => addSub(group.id, newSubInput));
    els.manageGroupsContainer.appendChild(node);
  });
}

function renderLogFilters() {
  const options = ['<option value="all">All groups</option>'].concat(sortedGroups().map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`));
  els.filterGroup.innerHTML = options.join('');
}

function renderLogView() {
  const query = els.searchLog.value.trim().toLowerCase();
  const groupId = els.filterGroup.value;
  const from = els.filterFrom.value;
  const to = els.filterTo.value;

  const filtered = [...state.logs]
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))
    .filter(log => {
      const group = state.groups.find(g => g.id === log.groupId);
      const sub = group?.subChores.find(s => s.id === log.subChoreId);
      const hay = [group?.name || '', sub?.name || '', log.note || ''].join(' ').toLowerCase();
      const effectiveDate = log.effectiveDate;
      const matchQuery = !query || hay.includes(query);
      const matchGroup = groupId === 'all' || log.groupId === groupId;
      const matchFrom = !from || effectiveDate >= from;
      const matchTo = !to || effectiveDate <= to;
      return matchQuery && matchGroup && matchFrom && matchTo;
    });

  els.logContainer.innerHTML = '';
  if (!filtered.length) {
    els.logContainer.innerHTML = `<div class="empty">No log entries match the filters.</div>`;
    return;
  }

  const grouped = groupBy(filtered, log => log.effectiveDate);
  Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(date => {
    const dayBlock = document.createElement('section');
    dayBlock.className = 'card log-day';
    dayBlock.innerHTML = `<h3>${formatDateHeading(date)}</h3>`;
    const stack = document.createElement('div');
    stack.className = 'stack gap-sm';

    grouped[date].forEach(log => {
      const group = state.groups.find(g => g.id === log.groupId);
      const sub = group?.subChores.find(s => s.id === log.subChoreId);
      const entry = document.createElement('article');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <div class="log-row">
          <strong>${escapeHtml(group?.name || 'Deleted group')} / ${escapeHtml(sub?.name || 'Deleted sub-chore')}</strong>
          <span class="log-action-badge ${log.actionType === 'plus' ? 'badge-plus' : 'badge-minus'}">${log.actionType === 'plus' ? '+' : '-'}${log.amount || 1}</span>
        </div>
        <div class="log-meta muted small">
          <span>${formatTime(log.effectiveTime)}</span>
          ${log.isManualEntry ? '<span>• manual/backdated</span>' : ''}
          <span>• entered ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(log.loggedAt))}</span>
        </div>
        ${log.note ? `<p class="small">${escapeHtml(log.note)}</p>` : ''}
        <div class="sub-actions">
          <button class="mini-btn edit-log">Edit</button>
          <button class="danger-btn delete-log">Delete</button>
        </div>
      `;
      entry.querySelector('.edit-log').addEventListener('click', () => openManualDialog({ logId: log.id }));
      entry.querySelector('.delete-log').addEventListener('click', () => deleteLog(log.id));
      stack.appendChild(entry);
    });
    dayBlock.appendChild(stack);
    els.logContainer.appendChild(dayBlock);
  });
}

function renderStats() {
  const today = todayString();
  const weekAgo = offsetDateString(-6);
  const plusLogs = state.logs.filter(log => log.actionType === 'plus');
  els.todayCount.textContent = plusLogs.filter(log => log.effectiveDate === today).length;
  els.weekCount.textContent = plusLogs.filter(log => log.effectiveDate >= weekAgo && log.effectiveDate <= today).length;
  els.streakCount.textContent = computeDailyStreak();
}

function addGroup() {
  const name = els.newGroupName.value.trim();
  if (!name) return;
  state.groups.push({ id: crypto.randomUUID(), name, archived: false, sortOrder: state.groups.length + 1, subChores: [] });
  els.newGroupName.value = '';
  renderAll();
}

function deleteGroup(groupId) {
  if (!confirm('Delete this group and its sub-chores? Logs will stay but show as deleted items.')) return;
  state.groups = state.groups.filter(g => g.id !== groupId);
  renderAll();
}

function addSub(groupId, input) {
  const name = input.value.trim();
  if (!name) return;
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;
  group.subChores.push({ id: crypto.randomUUID(), name, archived: false, sortOrder: group.subChores.length + 1 });
  input.value = '';
  renderAll();
}

function deleteSub(groupId, subId) {
  if (!confirm('Delete this sub-chore? Existing logs will remain.')) return;
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;
  group.subChores = group.subChores.filter(s => s.id !== subId);
  renderAll();
}

function moveSub(groupId, subId, delta) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;
  const subs = sortedSubs(group);
  const idx = subs.findIndex(s => s.id === subId);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= subs.length) return;
  [subs[idx].sortOrder, subs[target].sortOrder] = [subs[target].sortOrder, subs[idx].sortOrder];
  group.subChores = subs;
  renderAll();
}

function quickLog(groupId, subChoreId, actionType) {
  addLog({ groupId, subChoreId, actionType, amount: 1, effectiveDate: todayString(), effectiveTime: nowTimeString(), note: '', isManualEntry: false });
  renderAll();
}

function addLog({ groupId, subChoreId, actionType, amount, effectiveDate, effectiveTime, note, isManualEntry }) {
  state.logs.push({
    id: crypto.randomUUID(),
    groupId,
    subChoreId,
    actionType,
    amount: Number(amount) || 1,
    effectiveDate,
    effectiveTime,
    note: note || '',
    isManualEntry: !!isManualEntry,
    loggedAt: new Date().toISOString(),
  });
}

function deleteLog(logId) {
  if (!confirm('Delete this log entry?')) return;
  state.logs = state.logs.filter(log => log.id !== logId);
  renderAll();
}

function openManualDialog(options = {}) {
  hydrateManualDefaults();
  populateManualGroups();
  els.manualTitle.textContent = options.logId ? 'Edit Entry' : 'Manual Entry';
  els.editingLogId.value = options.logId || '';

  if (options.logId) {
    const log = state.logs.find(item => item.id === options.logId);
    if (log) {
      els.manualGroup.value = log.groupId;
      syncManualSubChores(log.subChoreId);
      els.manualAction.value = log.actionType;
      els.manualAmount.value = log.amount || 1;
      els.manualDate.value = log.effectiveDate;
      els.manualTime.value = log.effectiveTime;
      els.manualNote.value = log.note || '';
    }
  } else {
    if (options.groupId) els.manualGroup.value = options.groupId;
    syncManualSubChores(options.subChoreId);
  }
  els.manualDialog.showModal();
}

function hydrateManualDefaults() {
  els.manualDate.value = todayString();
  els.manualTime.value = nowTimeString();
  els.manualAction.value = 'plus';
  els.manualAmount.value = 1;
  els.manualNote.value = '';
  els.editingLogId.value = '';
}

function populateManualGroups() {
  const groups = sortedGroups();
  els.manualGroup.innerHTML = groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  syncManualSubChores();
}

function syncManualSubChores(selectedId) {
  const group = state.groups.find(g => g.id === els.manualGroup.value) || sortedGroups()[0];
  const subs = sortedSubs(group || { subChores: [] });
  els.manualSubChore.innerHTML = subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if (selectedId) els.manualSubChore.value = selectedId;
}

function saveManualEntry(event) {
  event.preventDefault();
  const payload = {
    groupId: els.manualGroup.value,
    subChoreId: els.manualSubChore.value,
    actionType: els.manualAction.value,
    amount: Number(els.manualAmount.value) || 1,
    effectiveDate: els.manualDate.value,
    effectiveTime: els.manualTime.value,
    note: els.manualNote.value.trim(),
    isManualEntry: true,
  };
  if (!payload.groupId || !payload.subChoreId || !payload.effectiveDate || !payload.effectiveTime) return;

  const existingId = els.editingLogId.value;
  if (existingId) {
    const log = state.logs.find(item => item.id === existingId);
    if (log) {
      Object.assign(log, payload);
    }
  } else {
    addLog(payload);
  }
  els.manualDialog.close();
  renderAll();
}

function sortedGroups() {
  return [...state.groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function sortedSubs(group) {
  return [...(group?.subChores || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function getLastLog(groupId, subChoreId) {
  return [...state.logs]
    .filter(log => log.groupId === groupId && log.subChoreId === subChoreId)
    .sort((a, b) => `${b.effectiveDate}T${b.effectiveTime}`.localeCompare(`${a.effectiveDate}T${a.effectiveTime}`))[0];
}

function computeDailyStreak() {
  const plusDays = [...new Set(state.logs.filter(log => log.actionType === 'plus').map(log => log.effectiveDate))].sort().reverse();
  if (!plusDays.length) return 0;
  let streak = 0;
  let cursor = todayString();
  while (plusDays.includes(cursor)) {
    streak += 1;
    cursor = offsetDateString(-(streak));
  }
  return streak;
}

function formatEffective(log) {
  return `${formatDateHeading(log.effectiveDate)} at ${formatTime(log.effectiveTime)}`;
}

function formatDateHeading(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const d = new Date(); d.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nowTimeString() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function offsetDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
