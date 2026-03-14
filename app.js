
const STORAGE_KEY = "chore_logger_v5_data";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const STARTER_TEMPLATE = {
  version: 5,
  settings: { collapseDefault: false },
  filters: { range: "all" },
  groups: [
    { id: uid(), name: "Kitchen", chores: [
      { id: uid(), name: "Load Dishwasher" },
      { id: uid(), name: "Take out Trash" },
      { id: uid(), name: "Wipe Counters" },
      { id: uid(), name: "Wipe Tables" },
      { id: uid(), name: "Clean Stove" },
      { id: uid(), name: "Sweep" },
      { id: uid(), name: "Mop" }
    ]},
    { id: uid(), name: "Bentleys Bathroom", chores: [
      { id: uid(), name: "Clean Toilet" },
      { id: uid(), name: "Clean Sink" },
      { id: uid(), name: "Clean Mirror" },
      { id: uid(), name: "Pick up Clothes" },
      { id: uid(), name: "Pick up Toys" },
      { id: uid(), name: "Take out Trash" }
    ]},
    { id: uid(), name: "Master Bedroom", chores: [
      { id: uid(), name: "Make the Bed" },
      { id: uid(), name: "Pick up Trash" },
      { id: uid(), name: "Gather Dog Toys" },
      { id: uid(), name: "Gather Dishes" },
      { id: uid(), name: "Vacuum" }
    ]},
    { id: uid(), name: "Master Bath", chores: [
      { id: uid(), name: "Pick up Clothes" },
      { id: uid(), name: "Clean Sink" },
      { id: uid(), name: "Clean Shower" },
      { id: uid(), name: "Organize Counter" },
      { id: uid(), name: "Sweep" },
      { id: uid(), name: "Clean Toilet" },
      { id: uid(), name: "Clean Mirror" },
      { id: uid(), name: "Take out Trash" }
    ]},
    { id: uid(), name: "Dogs", chores: [
      { id: uid(), name: "(AM) Lets Dogs Out" },
      { id: uid(), name: "(AM) Feed Dogs" },
      { id: uid(), name: "(AM) Let Broadie Out" },
      { id: uid(), name: "(AM) Feed Broadie" },
      { id: uid(), name: "(PM) Let Dogs Out" },
      { id: uid(), name: "(PM) Feed Dogs" },
      { id: uid(), name: "(PM) Let Broadie Out" },
      { id: uid(), name: "(PM) Feed Broadie" }
    ]},
    { id: uid(), name: "Car", chores: [
      { id: uid(), name: "Clean Out Interior" }
    ]}
  ],
  logs: [],
  ui: { selectedGroupId: null, collapsedGroups: {}, lastManualGroupId: null }
};

let state = loadState();
let toastTimer = null;

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function normalizeState(parsed) {
  parsed.settings ||= { collapseDefault: false };
  parsed.groups ||= [];
  parsed.logs ||= [];
  parsed.ui ||= { selectedGroupId: null, collapsedGroups: {}, lastManualGroupId: null };
  parsed.ui.collapsedGroups ||= {};
  parsed.filters ||= { range: "all" };
  return parsed;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = deepClone(STARTER_TEMPLATE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    const seeded = deepClone(STARTER_TEMPLATE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
}

function formatDate(dateString) {
  const dt = new Date(dateString + "T00:00:00");
  return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateString, timeString) {
  const dt = new Date(`${dateString}T${timeString}`);
  return dt.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function todayParts() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${tabName}Tab`));
}

function getGroupById(groupId) { return state.groups.find(g => g.id === groupId); }

function getChoreByIds(groupId, choreId) {
  const group = getGroupById(groupId);
  return group ? group.chores.find(ch => ch.id === choreId) || null : null;
}

function getLastLog(groupId, choreId) {
  return state.logs
    .filter(log => log.groupId === groupId && log.choreId === choreId)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function getGroupLogs(groupId) { return state.logs.filter(log => log.groupId === groupId); }
function getGroupTodayCount(groupId) { return state.logs.filter(log => log.groupId === groupId && log.date === todayParts().date).length; }
function getGroupLastTouched(groupId) { return getGroupLogs(groupId).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0] || null; }

function addLog({ groupId, choreId, action = "plus", date, time, note = "", manual = false, sourceBtn = null }) {
  const group = getGroupById(groupId);
  const chore = getChoreByIds(groupId, choreId);
  if (!group || !chore) return;
  state.logs.unshift({
    id: uid(), groupId, choreId, groupName: group.name, choreName: chore.name,
    action, date, time, note: note.trim(), manual, createdAt: new Date().toISOString()
  });
  state.ui.lastManualGroupId = groupId;
  saveState();
  if (sourceBtn) {
    sourceBtn.classList.add("pulse");
    setTimeout(() => sourceBtn.classList.remove("pulse"), 220);
  }
  showToast(`Logged: ${group.name} / ${chore.name} ${action === "plus" ? "+" : "-"}`);
  renderAll();
}

function getStats() {
  const now = new Date();
  const today = todayParts().date;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekLocal = new Date(weekStart.getTime() - weekStart.getTimezoneOffset() * 60000);
  const weekStartKey = weekLocal.toISOString().slice(0, 10);

  const todayCount = state.logs.filter(log => log.date === today).length;
  const weekCount = state.logs.filter(log => log.date >= weekStartKey).length;

  const uniqueDays = [...new Set(state.logs.map(log => log.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date(today + "T00:00:00");
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (uniqueDays.includes(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return { todayCount, weekCount, streak };
}

function renderHome() {
  const container = document.getElementById("homeGroups");
  container.innerHTML = "";

  state.groups.forEach(group => {
    const last = getGroupLastTouched(group.id);
    const todayCount = getGroupTodayCount(group.id);
    const total = group.chores.length || 1;
    const percent = Math.min(100, Math.round((todayCount / total) * 100));
    const isCollapsed = !!state.ui.collapsedGroups[group.id];

    const card = document.createElement("article");
    card.className = `group-card ${isCollapsed ? "collapsed" : ""}`;
    card.innerHTML = `
      <div class="group-line">
        <div>
          <h3>${escapeHtml(group.name)}</h3>
          <p>${group.chores.length} sub-chore${group.chores.length === 1 ? "" : "s"}</p>
        </div>
        <div class="home-cta">
          <button class="btn" data-toggle-collapse="${group.id}">${isCollapsed ? "Expand" : "Collapse"}</button>
          <button class="group-open" data-group-open="${group.id}" aria-label="Open ${escapeHtml(group.name)}">›</button>
        </div>
      </div>
      <div class="group-details">
        <div class="home-meta">
          <div class="pill">Today: ${todayCount}</div>
          <div class="pill">${last ? `Last: ${formatDateTime(last.date, last.time)}` : "No logs yet"}</div>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="group-mini-list">
          ${group.chores.slice(0,3).map(chore => {
            const lastLog = getLastLog(group.id, chore.id);
            return `<div class="group-mini-item"><span>${escapeHtml(chore.name)}</span><span>${lastLog ? `${lastLog.action === "plus" ? "+" : "-"} ${lastLog.time}` : "—"}</span></div>`;
          }).join("")}
          ${group.chores.length > 3 ? `<div class="group-mini-item"><span>More chores</span><span>+${group.chores.length - 3}</span></div>` : ""}
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-group-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.ui.selectedGroupId = btn.dataset.groupOpen;
      saveState();
      renderGroupView();
      switchTab("group");
    });
  });

  container.querySelectorAll("[data-toggle-collapse]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleCollapse;
      state.ui.collapsedGroups[id] = !state.ui.collapsedGroups[id];
      saveState();
      renderHome();
    });
  });
}

function renderGroupView() {
  const group = getGroupById(state.ui.selectedGroupId);
  const title = document.getElementById("groupTitle");
  const subtitle = document.getElementById("groupSubtitle");
  const container = document.getElementById("groupChores");
  container.innerHTML = "";

  if (!group) {
    title.textContent = "Select a group";
    subtitle.textContent = "Tap a group from Home.";
    return;
  }

  title.textContent = group.name;
  subtitle.textContent = `${group.chores.length} sub-chore${group.chores.length === 1 ? "" : "s"} • ${getGroupTodayCount(group.id)} logged today`;

  group.chores.forEach(chore => {
    const last = getLastLog(group.id, chore.id);
    const card = document.createElement("article");
    card.className = "chore-card";
    card.innerHTML = `
      <div class="chore-head">
        <div>
          <h3>${escapeHtml(chore.name)}</h3>
          <p>${last ? `${last.action === "plus" ? "+" : "-"} logged ${formatDateTime(last.date, last.time)}` : "No logs yet"}</p>
        </div>
      </div>
      <div class="chore-actions">
        <button class="action-btn minus" data-log-action="minus" data-group-id="${group.id}" data-chore-id="${chore.id}">−</button>
        <button class="action-btn plus" data-log-action="plus" data-group-id="${group.id}" data-chore-id="${chore.id}">+</button>
        <button class="manual-mini" data-manual-group="${group.id}" data-manual-chore="${chore.id}">Manual</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-log-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const parts = todayParts();
      addLog({
        groupId: btn.dataset.groupId,
        choreId: btn.dataset.choreId,
        action: btn.dataset.logAction,
        date: parts.date,
        time: parts.time,
        manual: false,
        sourceBtn: btn
      });
    });
  });

  container.querySelectorAll("[data-manual-group]").forEach(btn => {
    btn.addEventListener("click", () => openManualDialog(btn.dataset.manualGroup, btn.dataset.manualChore));
  });
}

function renderStats() {
  const { todayCount, weekCount, streak } = getStats();
  document.getElementById("todayCount").textContent = todayCount;
  document.getElementById("weekCount").textContent = weekCount;
  document.getElementById("streakCount").textContent = streak;
}

function renderLogFilters() {
  const select = document.getElementById("logGroupFilter");
  const current = select.value;
  select.innerHTML = `<option value="">All groups</option>`;
  state.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    select.appendChild(option);
  });
  select.value = current;
}

function getFilteredLogs() {
  const search = document.getElementById("logSearch").value.trim().toLowerCase();
  const groupFilter = document.getElementById("logGroupFilter").value;
  const actionFilter = document.getElementById("logActionFilter").value;
  const range = state.filters.range || "all";
  const from = document.getElementById("logDateFrom").value;
  const to = document.getElementById("logDateTo").value;
  const today = todayParts().date;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekLocal = new Date(weekStart.getTime() - weekStart.getTimezoneOffset() * 60000);
  const weekStartKey = weekLocal.toISOString().slice(0, 10);

  return state.logs.filter(log => {
    const matchesSearch = !search || [log.groupName, log.choreName, log.note].join(" ").toLowerCase().includes(search);
    const matchesGroup = !groupFilter || log.groupId === groupFilter;
    const matchesAction = !actionFilter || log.action === actionFilter;
    let matchesRange = true;
    if (range === "today") matchesRange = log.date === today;
    if (range === "week") matchesRange = log.date >= weekStartKey;
    if (range === "custom") {
      if (from) matchesRange = matchesRange && log.date >= from;
      if (to) matchesRange = matchesRange && log.date <= to;
    }
    return matchesSearch && matchesGroup && matchesAction && matchesRange;
  });
}

function renderLogs() {
  const list = document.getElementById("logList");
  list.innerHTML = "";
  const logs = getFilteredLogs();

  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `<p>No log entries match this filter.</p>`;
    list.appendChild(empty);
    return;
  }

  const grouped = {};
  logs.forEach(log => {
    if (!grouped[log.date]) grouped[log.date] = [];
    grouped[log.date].push(log);
  });

  Object.keys(grouped).sort((a,b) => b.localeCompare(a)).forEach(date => {
    const dayWrap = document.createElement("section");
    dayWrap.className = "day-group";
    dayWrap.innerHTML = `<h3 class="day-heading">${formatDate(date)}</h3>`;
    grouped[date].forEach(log => {
      const card = document.createElement("article");
      card.className = "log-card";
      card.innerHTML = `
        <div class="log-top">
          <div>
            <h4>${escapeHtml(log.choreName)}</h4>
            <p>${escapeHtml(log.groupName)}</p>
          </div>
          <div class="pill ${log.action}">${log.action === "plus" ? "+" : "-"} • ${formatDateTime(log.date, log.time)}</div>
        </div>
        ${log.note ? `<p>${escapeHtml(log.note)}</p>` : ""}
        <div class="log-actions">
          <button class="btn" data-edit-log="${log.id}">Edit</button>
          <button class="btn danger" data-delete-log="${log.id}">Delete</button>
        </div>
      `;
      dayWrap.appendChild(card);
    });
    list.appendChild(dayWrap);
  });

  list.querySelectorAll("[data-delete-log]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteLog;
      if (!confirm("Delete this log entry?")) return;
      state.logs = state.logs.filter(log => log.id !== id);
      saveState();
      renderAll();
      showToast("Log entry deleted");
    });
  });

  list.querySelectorAll("[data-edit-log]").forEach(btn => {
    btn.addEventListener("click", () => openEditDialog(btn.dataset.editLog));
  });
}

function renderManage() {
  const container = document.getElementById("manageGroups");
  container.innerHTML = "";
  state.groups.forEach(group => {
    const card = document.createElement("article");
    card.className = "manage-group-card";
    card.innerHTML = `
      <div class="manage-row">
        <strong>${escapeHtml(group.name)}</strong>
        <div class="manage-actions">
          <button class="btn" data-rename-group="${group.id}">Rename</button>
          <button class="btn danger" data-delete-group="${group.id}">Delete</button>
        </div>
      </div>
      <form class="inline-form" data-add-chore-form="${group.id}">
        <input type="text" name="choreName" maxlength="60" placeholder="New sub-chore for ${escapeHtml(group.name)}" />
        <button class="btn btn-primary" type="submit">Add Sub-chore</button>
      </form>
      <div class="sub-list">
        ${group.chores.map(ch => `
          <div class="sub-item">
            <span>${escapeHtml(ch.name)}</span>
            <div class="sub-actions">
              <button class="btn" data-rename-chore="${group.id}|${ch.id}">Rename</button>
              <button class="btn danger" data-delete-chore="${group.id}|${ch.id}">Delete</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-add-chore-form]").forEach(form => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const groupId = form.dataset.addChoreForm;
      const input = form.querySelector('input[name="choreName"]');
      const value = input.value.trim();
      if (!value) return;
      const group = getGroupById(groupId);
      group.chores.push({ id: uid(), name: value });
      input.value = "";
      saveState();
      renderAll();
      showToast("Sub-chore added");
    });
  });

  container.querySelectorAll("[data-rename-group]").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = getGroupById(btn.dataset.renameGroup);
      const next = prompt("Rename group", group.name);
      if (!next || !next.trim()) return;
      group.name = next.trim();
      state.logs.forEach(log => { if (log.groupId === group.id) log.groupName = group.name; });
      saveState();
      renderAll();
      showToast("Group renamed");
    });
  });

  container.querySelectorAll("[data-delete-group]").forEach(btn => {
    btn.addEventListener("click", () => {
      const groupId = btn.dataset.deleteGroup;
      const group = getGroupById(groupId);
      if (!confirm(`Delete group "${group.name}" and its logs?`)) return;
      state.groups = state.groups.filter(g => g.id !== groupId);
      state.logs = state.logs.filter(log => log.groupId !== groupId);
      if (state.ui.selectedGroupId === groupId) state.ui.selectedGroupId = null;
      delete state.ui.collapsedGroups[groupId];
      saveState();
      renderAll();
      showToast("Group deleted");
    });
  });

  container.querySelectorAll("[data-rename-chore]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [groupId, choreId] = btn.dataset.renameChore.split("|");
      const chore = getChoreByIds(groupId, choreId);
      const next = prompt("Rename sub-chore", chore.name);
      if (!next || !next.trim()) return;
      chore.name = next.trim();
      state.logs.forEach(log => { if (log.choreId === chore.id) log.choreName = chore.name; });
      saveState();
      renderAll();
      showToast("Sub-chore renamed");
    });
  });

  container.querySelectorAll("[data-delete-chore]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [groupId, choreId] = btn.dataset.deleteChore.split("|");
      const group = getGroupById(groupId);
      const chore = getChoreByIds(groupId, choreId);
      if (!confirm(`Delete sub-chore "${chore.name}" and its logs?`)) return;
      group.chores = group.chores.filter(ch => ch.id !== choreId);
      state.logs = state.logs.filter(log => log.choreId !== choreId);
      saveState();
      renderAll();
      showToast("Sub-chore deleted");
    });
  });
}

function populateManualOptions(groupId, choreId) {
  const groupSelect = document.getElementById("manualGroup");
  const choreSelect = document.getElementById("manualChore");
  groupSelect.innerHTML = "";
  state.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });

  const selectedGroupId = groupId || state.ui.lastManualGroupId || state.ui.selectedGroupId || state.groups[0]?.id;
  if (!selectedGroupId) return;
  groupSelect.value = selectedGroupId;
  populateManualChoreOptions(selectedGroupId, choreId);

  groupSelect.onchange = () => {
    state.ui.lastManualGroupId = groupSelect.value;
    saveState();
    populateManualChoreOptions(groupSelect.value);
  };
}

function populateManualChoreOptions(groupId, selectedChoreId = null) {
  const choreSelect = document.getElementById("manualChore");
  const group = getGroupById(groupId);
  choreSelect.innerHTML = "";
  (group?.chores || []).forEach(chore => {
    const option = document.createElement("option");
    option.value = chore.id;
    option.textContent = chore.name;
    choreSelect.appendChild(option);
  });
  if (selectedChoreId) choreSelect.value = selectedChoreId;
}

function openManualDialog(groupId = null, choreId = null) {
  const dialog = document.getElementById("manualDialog");
  const parts = todayParts();
  populateManualOptions(groupId, choreId);
  document.getElementById("manualDate").value = parts.date;
  document.getElementById("manualTime").value = parts.time;
  document.getElementById("manualAction").value = "plus";
  document.getElementById("manualNote").value = "";
  dialog.showModal();
}

function closeManualDialog() { document.getElementById("manualDialog").close(); }

function openEditDialog(logId) {
  const log = state.logs.find(item => item.id === logId);
  if (!log) return;
  document.getElementById("editLogId").value = log.id;
  document.getElementById("editAction").value = log.action;
  document.getElementById("editDate").value = log.date;
  document.getElementById("editTime").value = log.time;
  document.getElementById("editNote").value = log.note || "";
  document.getElementById("editLogDialog").showModal();
}

function closeEditDialog() { document.getElementById("editLogDialog").close(); }

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chore-backup-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = normalizeState(JSON.parse(reader.result));
      if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.logs)) throw new Error("Invalid backup");
      state = parsed;
      saveState();
      renderAll();
      showToast("Backup imported");
    } catch {
      alert("That backup file is invalid.");
    }
  };
  reader.readAsText(file);
}

function restoreStarterTemplate() {
  if (!confirm("Replace current data with the starter template? Export first if you need a backup.")) return;
  state = deepClone(STARTER_TEMPLATE);
  saveState();
  renderAll();
  showToast("Starter template restored");
}

function wipeAllData() {
  if (!confirm("Wipe everything? This cannot be undone unless you exported a backup.")) return;
  state = deepClone(STARTER_TEMPLATE);
  state.groups = [];
  state.logs = [];
  state.ui.selectedGroupId = null;
  saveState();
  renderAll();
  showToast("All data wiped");
}

function backupSelfTest() {
  try {
    const parsed = normalizeState(JSON.parse(JSON.stringify(state)));
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.logs)) throw new Error();
    showToast("Backup self-test passed");
  } catch {
    alert("Backup self-test failed.");
  }
}

function setRange(range) {
  state.filters.range = range;
  saveState();
  document.querySelectorAll("[data-range]").forEach(btn => btn.classList.toggle("active", btn.dataset.range === range));
  document.getElementById("customDateRow").classList.toggle("hidden", range !== "custom");
  renderLogs();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderAll() {
  renderStats();
  renderHome();
  renderGroupView();
  renderLogFilters();
  renderLogs();
  renderManage();
  document.getElementById("collapseDefaultToggle").checked = !!state.settings.collapseDefault;
  document.querySelectorAll("[data-range]").forEach(btn => btn.classList.toggle("active", btn.dataset.range === (state.filters.range || "all")));
  document.getElementById("customDateRow").classList.toggle("hidden", (state.filters.range || "all") !== "custom");
}

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
document.getElementById("manualEntryBtnTop").addEventListener("click", () => openManualDialog());

document.getElementById("collapseAllBtn").addEventListener("click", () => {
  state.groups.forEach(group => state.ui.collapsedGroups[group.id] = true);
  saveState(); switchTab("home"); renderHome(); showToast("All home cards collapsed");
});
document.getElementById("expandAllBtn").addEventListener("click", () => {
  state.groups.forEach(group => state.ui.collapsedGroups[group.id] = false);
  saveState(); switchTab("home"); renderHome(); showToast("All home cards expanded");
});
document.getElementById("backToHomeBtn").addEventListener("click", () => switchTab("home"));

document.getElementById("groupForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("newGroupName");
  const value = input.value.trim();
  if (!value) return;
  const newGroup = { id: uid(), name: value, chores: [] };
  state.groups.push(newGroup);
  state.ui.collapsedGroups[newGroup.id] = !!state.settings.collapseDefault;
  input.value = "";
  saveState(); renderAll(); showToast("Group added");
});

document.getElementById("manualForm").addEventListener("submit", (e) => {
  e.preventDefault();
  addLog({
    groupId: document.getElementById("manualGroup").value,
    choreId: document.getElementById("manualChore").value,
    action: document.getElementById("manualAction").value,
    date: document.getElementById("manualDate").value,
    time: document.getElementById("manualTime").value,
    note: document.getElementById("manualNote").value,
    manual: true
  });
  closeManualDialog();
});

document.getElementById("editLogForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("editLogId").value;
  const log = state.logs.find(item => item.id === id);
  if (!log) return;
  log.action = document.getElementById("editAction").value;
  log.date = document.getElementById("editDate").value;
  log.time = document.getElementById("editTime").value;
  log.note = document.getElementById("editNote").value.trim();
  saveState(); renderAll(); closeEditDialog(); showToast("Log updated");
});

document.getElementById("closeManualDialog").addEventListener("click", closeManualDialog);
document.getElementById("cancelManualDialog").addEventListener("click", closeManualDialog);
document.getElementById("closeEditDialog").addEventListener("click", closeEditDialog);
document.getElementById("cancelEditDialog").addEventListener("click", closeEditDialog);

document.getElementById("manualNowBtn").addEventListener("click", () => {
  const parts = todayParts();
  document.getElementById("manualDate").value = parts.date;
  document.getElementById("manualTime").value = parts.time;
});

document.getElementById("logSearch").addEventListener("input", renderLogs);
document.getElementById("logGroupFilter").addEventListener("change", renderLogs);
document.getElementById("logActionFilter").addEventListener("change", renderLogs);
document.getElementById("logDateFrom").addEventListener("change", renderLogs);
document.getElementById("logDateTo").addEventListener("change", renderLogs);
document.querySelectorAll("[data-range]").forEach(btn => btn.addEventListener("click", () => setRange(btn.dataset.range)));

document.getElementById("restoreTemplateBtn").addEventListener("click", restoreStarterTemplate);
document.getElementById("exportBtn").addEventListener("click", exportBackup);
document.getElementById("importInput").addEventListener("change", (e) => importBackup(e.target.files[0]));
document.getElementById("wipeDataBtn").addEventListener("click", wipeAllData);
document.getElementById("backupSelfTestBtn").addEventListener("click", backupSelfTest);
document.getElementById("collapseDefaultToggle").addEventListener("change", (e) => {
  state.settings.collapseDefault = e.target.checked;
  saveState();
  showToast("Default collapse setting updated");
});

(function applyDefaultCollapse() {
  if (Object.keys(state.ui.collapsedGroups || {}).length === 0) {
    state.groups.forEach(group => state.ui.collapsedGroups[group.id] = !!state.settings.collapseDefault);
    saveState();
  }
})();

renderAll();
