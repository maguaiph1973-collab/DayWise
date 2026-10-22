(() => {
  "use strict";
  const TASKS_KEY = "daywise_tasks_v1";
  const REVIEW_KEY = "daywise_review_v1";
  const $ = (id) => document.getElementById(id);
  const todayISO = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  };
  const dateLabel = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  };
  let tasks = load(TASKS_KEY, []);
  if (!Array.isArray(tasks)) tasks = [];
  let filter = "all";
  let editingId = null;
  let toastTimer;
  const saveTasks = () => {
    try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); return true; }
    catch { showToast("Browser storage is unavailable. Please export or copy important notes."); return false; }
  };
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
  }
  function isOverdue(task) {
    return !task.done && task.due && task.due < todayISO();
  }
  function taskMatches(task) {
    if (filter === "open") return !task.done;
    if (filter === "today") return task.due === todayISO();
    if (filter === "overdue") return isOverdue(task);
    if (filter === "done") return task.done;
    return true;
  }
  function renderStats() {
    const todayTasks = tasks.filter(t => t.due === todayISO());
    const doneToday = tasks.filter(t => t.done && t.completedAt === todayISO()).length;
    $("stat-today").textContent = todayTasks.length;
    $("stat-done").textContent = tasks.filter(t => t.done).length;
    $("stat-done-note").textContent = doneToday ? doneToday + " completed today" : "Keep moving forward";
    $("stat-overdue").textContent = tasks.filter(isOverdue).length;
    $("stat-open").textContent = tasks.filter(t => !t.done).length;
    $("task-count").textContent = tasks.length ? tasks.filter(t => !t.done).length + " open · " + tasks.length + " total" : "Organize the next right step";
  }
  function renderTasks() {
    const list = $("task-list");
    const visible = tasks.filter(taskMatches).sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const priority = { High: 0, Medium: 1, Low: 2 };
      if ((priority[a.priority] ?? 1) !== (priority[b.priority] ?? 1)) return (priority[a.priority] ?? 1) - (priority[b.priority] ?? 1);
      return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
    });
    if (!visible.length) {
      list.innerHTML = '<div class="empty"><strong>' + (tasks.length ? "Nothing in this view." : "Your workspace is ready.") + '</strong>' + (tasks.length ? "Try another filter or add a new task." : "Add your first task to start planning your day.") + "</div>";
      return;
    }
    list.innerHTML = visible.map(task => {
      const priority = ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium";
      const meta = [];
      if (task.due) meta.push('<span class="pill ' + (isOverdue(task) ? "overdue" : "") + '">' + (isOverdue(task) ? "Overdue · " : "Due · ") + escapeHTML(dateLabel(task.due)) + "</span>");
      meta.push('<span class="pill ' + priority.toLowerCase() + '">' + escapeHTML(priority) + "</span>");
      if (task.owner) meta.push('<span class="pill">Owner · ' + escapeHTML(task.owner) + "</span>");
      if (task.followup) meta.push('<span class="pill">Follow-up · ' + escapeHTML(dateLabel(task.followup)) + "</span>");
      if (task.notes) meta.push('<div class="muted" style="width:100%;line-height:1.5;margin-top:3px">' + escapeHTML(task.notes).replace(/\n/g, "<br>") + "</div>");
      return '<article class="task ' + (task.done ? "done" : "") + '"><input type="checkbox" data-action="toggle" data-id="' + escapeHTML(task.id) + '" aria-label="Mark ' + escapeHTML(task.title) + ' complete" ' + (task.done ? "checked" : "") + '><div><div class="task-title">' + escapeHTML(task.title) + '</div><div class="task-meta">' + meta.join("") + '</div></div><div class="task-actions"><button type="button" class="icon-button" data-action="edit" data-id="' + escapeHTML(task.id) + '" aria-label="Edit task">Edit</button><button type="button" class="icon-button" data-action="delete" data-id="' + escapeHTML(task.id) + '" aria-label="Delete task">Delete</button></div></article>';
    }).join("");
  }
  function renderFollowups() {
    const list = $("followup-list");
    const upcoming = tasks.filter(t => !t.done && t.followup).sort((a, b) => a.followup.localeCompare(b.followup)).slice(0, 6);
    if (!upcoming.length) {
      list.innerHTML = '<div class="empty">No follow-ups scheduled yet.<br>Add a follow-up date to a task and it will appear here.</div>';
      return;
    }
    list.innerHTML = upcoming.map(t => '<div style="border:1px solid var(--border);border-radius:11px;padding:12px"><div style="font-size:13px;font-weight:750;line-height:1.4">' + escapeHTML(t.title) + '</div><div class="muted" style="margin-top:6px">' + escapeHTML(dateLabel(t.followup)) + (t.owner ? " · " + escapeHTML(t.owner) : "") + '</div><button type="button" class="link-button" data-action="edit" data-id="' + escapeHTML(t.id) + '" style="margin-top:8px;font-size:12px">Open task →</button></div>').join("");
  }
  function render() { renderStats(); renderTasks(); renderFollowups(); }
  function openForm(task) {
    editingId = task ? task.id : null;
    $("task-form").classList.remove("hidden");
    $("task-title-input").value = task?.title || "";
    $("task-due").value = task?.due || "";
    $("task-priority").value = task?.priority || "Medium";
    $("task-owner").value = task?.owner || "";
    $("task-followup").value = task?.followup || "";
    $("task-notes").value = task?.notes || "";
    $("save-task").textContent = task ? "Update task" : "Save task";
    $("add-toggle").textContent = "Close form";
    $("task-title-input").focus();
  }
  function closeForm() {
    $("task-form").reset();
    $("task-form").classList.add("hidden");
    editingId = null;
    $("save-task").textContent = "Save task";
    $("add-toggle").textContent = "+ Add task";
  }
  $("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  $("add-toggle").addEventListener("click", () => {
    if (!$("task-form").classList.contains("hidden")) closeForm();
    else openForm(null);
  });
  $("cancel-task").addEventListener("click", closeForm);
  $("task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("task-title-input").value.trim();
    if (!title) { $("task-title-input").focus(); return; }
    const data = {
      title, due: $("task-due").value, priority: $("task-priority").value,
      owner: $("task-owner").value.trim(), followup: $("task-followup").value,
      notes: $("task-notes").value.trim()
    };
    if (editingId) {
      const old = tasks.find(t => t.id === editingId);
      if (old) Object.assign(old, data, { updatedAt: new Date().toISOString() });
      showToast("Task updated.");
    } else {
      tasks.push({ id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2), ...data, done: false, createdAt: new Date().toISOString(), completedAt: null });
      showToast("Task added.");
    }
    saveTasks(); closeForm(); render();
  });
  $("filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    filter = button.dataset.filter;
    $("filters").querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
    renderTasks();
  });
  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const task = tasks.find(t => t.id === control.dataset.id);
    if (!task) return;
    const action = control.dataset.action;
    if (action === "edit") openForm(task);
    if (action === "delete") {
      if (!window.confirm('Delete "' + task.title + '"? This cannot be undone.')) return;
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks(); render(); showToast("Task deleted.");
    }
  });
  document.addEventListener("change", (event) => {
    const control = event.target.closest('[data-action="toggle"]');
    if (!control) return;
    const task = tasks.find(t => t.id === control.dataset.id);
    if (!task) return;
    task.done = control.checked;
    task.completedAt = task.done ? todayISO() : null;
    saveTasks(); render(); showToast(task.done ? "Marked complete." : "Task reopened.");
  });
  const savedReview = load(REVIEW_KEY, "");
  $("review-note").value = typeof savedReview === "string" ? savedReview : "";
  $("save-review").addEventListener("click", () => {
    try {
      localStorage.setItem(REVIEW_KEY, $("review-note").value);
      $("review-msg").textContent = "Saved in this browser.";
      showToast("End-of-day note saved.");
    } catch {
      $("review-msg").textContent = "Could not save. Please copy your note somewhere safe.";
    }
  });
  const exportButton = $("export-data");
  if (exportButton) exportButton.addEventListener("click", () => {
    const backup = { app: "DayWise", exportedAt: new Date().toISOString(), tasks, endOfDayNote: $("review-note").value };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "daywise-backup-" + todayISO() + ".json";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast("Backup downloaded.");
  });
  render();
})();