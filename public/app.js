/**
 * LifePilot AI — Client Application Logic
 * "LifePilot — Make space for what matters."
 */

// ============================================================================
// Single Shared Task Data Source (Shared with Server & AI Context)
// ============================================================================
const todayObj = new Date();
const fmtDate = (d) => d.toISOString().split('T')[0];

const todayStr = fmtDate(todayObj);
const tomorrowStr = fmtDate(new Date(Date.now() + 86400000));
const inTwoDaysStr = fmtDate(new Date(Date.now() + 86400000 * 2));
const inThreeDaysStr = fmtDate(new Date(Date.now() + 86400000 * 3));

const INITIAL_SHARED_TASKS = [
  {
    id: 'task_1',
    title: 'Review Java Object-Oriented Principles',
    description: 'Polymorphism, inheritance, and interface contracts practice',
    priority: 'High',
    category: 'Study',
    dueDate: tomorrowStr,
    timeEstimate: '2h',
    estimatedMinutes: 120,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_2',
    title: 'Deploy LifePilot AI web app to AWS hosting',
    description: 'Configure environment variables and run verify-bedrock on EC2',
    priority: 'High',
    category: 'Coding',
    dueDate: inTwoDaysStr,
    timeEstimate: '1.5h',
    estimatedMinutes: 90,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_3',
    title: 'Prepare slides and architecture demo video',
    description: 'Record 3-minute walkthrough explaining Bedrock Converse integration',
    priority: 'Medium',
    category: 'Work',
    dueDate: inThreeDaysStr,
    timeEstimate: '45m',
    estimatedMinutes: 45,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_4',
    title: 'Midday walk & hydration break',
    description: 'Screen-free recovery walk',
    priority: 'Low',
    category: 'Health',
    dueDate: todayStr,
    timeEstimate: '20m',
    estimatedMinutes: 20,
    completed: true,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
];

// Initial conversation history reflecting the exact shared tasks
const INITIAL_CONVERSATION = [
  {
    sender: 'user',
    text: 'Help me plan my day.',
    time: '9:30 AM'
  },
  {
    sender: 'assistant',
    text: `Let's organize your day around your active tasks:

I found three tasks to focus on:
1. **Review Java Object-Oriented Principles** — High priority (2h)
2. **Deploy LifePilot AI web app to AWS hosting** — High priority (1.5h)
3. **Prepare slides and architecture demo video** — Medium priority (45m)

Total estimated effort: **4h 15m remaining**.`,
    time: '9:30 AM',
    actions: [
      { type: 'create_plan', label: 'Create my daily plan' }
    ]
  }
];

// ============================================================================
// State Management
// ============================================================================
const state = {
  tasks: [],
  currentPlan: null,
  activePlanDay: 1,
  conversationHistory: [],
  activeView: 'viewOverview',
  taskFilter: 'all',
  taskSort: 'priority',
  searchQuery: '',
  ttsEnabled: false,
  isListening: false,
  isThinking: false,
  aiStatus: 'demo',
  aiStatusLabel: 'Demo Mode · Sample Responses',
  activeAbortController: null,
  conflictData: null
};

// ============================================================================
// Storage & Persistence
// ============================================================================
function loadStateFromStorage() {
  try {
    const savedTasks = localStorage.getItem('lifepilot_tasks_v2');
    if (savedTasks) {
      state.tasks = JSON.parse(savedTasks);
    } else {
      state.tasks = JSON.parse(JSON.stringify(INITIAL_SHARED_TASKS));
      saveTasksToStorage();
    }

    const savedPlan = localStorage.getItem('lifepilot_plan_v2');
    if (savedPlan) {
      state.currentPlan = JSON.parse(savedPlan);
    }

    const savedHistory = localStorage.getItem('lifepilot_history_v2');
    if (savedHistory) {
      state.conversationHistory = JSON.parse(savedHistory);
    } else {
      state.conversationHistory = JSON.parse(JSON.stringify(INITIAL_CONVERSATION));
      saveHistoryToStorage();
    }
  } catch (e) {
    console.error('Storage parse error:', e);
    state.tasks = JSON.parse(JSON.stringify(INITIAL_SHARED_TASKS));
  }
}

function saveTasksToStorage() {
  localStorage.setItem('lifepilot_tasks_v2', JSON.stringify(state.tasks));
  renderAllViews();
}

function savePlanToStorage() {
  if (state.currentPlan) {
    localStorage.setItem('lifepilot_plan_v2', JSON.stringify(state.currentPlan));
  } else {
    localStorage.removeItem('lifepilot_plan_v2');
  }
  renderOverviewPlan();
  renderPlansView();
}

function saveHistoryToStorage() {
  localStorage.setItem('lifepilot_history_v2', JSON.stringify(state.conversationHistory));
  renderConversationStream();
}

// ============================================================================
// Duration & Math Utilities
// ============================================================================
function parseEstimateToMinutes(estimate = '') {
  if (!estimate) return 30;
  const str = String(estimate).trim().toLowerCase();
  const hoursMatch = str.match(/([\d.]+)\s*h/);
  if (hoursMatch) return Math.round(parseFloat(hoursMatch[1]) * 60);
  const minsMatch = str.match(/(\d+)\s*m/);
  if (minsMatch) return parseInt(minsMatch[1], 10);
  const num = parseFloat(str);
  return isNaN(num) ? 30 : Math.round(num);
}

function formatDurationRemaining(minutes) {
  if (!minutes || minutes <= 0) return '0m remaining';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m remaining`;
  if (h > 0) return `${h}h remaining`;
  return `${m}m remaining`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// UI Toast Notifications
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  
  let icon = 'ℹ';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✕';
  else if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3200);
}

window.copySnippetToClipboard = function(btn) {
  const codeEl = btn.closest('.code-snippet-box')?.querySelector('code');
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.innerText).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1800);
      showToast('Code copied to clipboard', 'info');
    });
  }
};

// ============================================================================
// Advanced Markdown Formatter
// ============================================================================
function formatMarkdown(text) {
  if (!text) return '';

  // 1. Extract fenced code blocks first
  const codeBlocks = [];
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || 'code', code: code.trim() });
    return `___CODE_BLOCK_${idx}___`;
  });

  // 2. Escape HTML
  processed = escapeHtml(processed);

  // 3. Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code class="bubble-inline-code">$1</code>');

  // 4. Bold & Italic
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

  // 5. Line by line parsing for lists, headers, quotes
  const lines = processed.split('\n');
  const result = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Numbered list item: e.g. "1. Task title"
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol class="bubble-ol">'); inOl = true; }
      result.push(`<li><span class="ol-num">${olMatch[1]}</span><span class="ol-text">${olMatch[2]}</span></li>`);
      continue;
    }

    // Bullet list item: e.g. "- Task" or "* Task" or "• Task"
    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul class="bubble-ul">'); inUl = true; }
      result.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    // Close any open lists if on a non-list line
    if (inOl) { result.push('</ol>'); inOl = false; }
    if (inUl) { result.push('</ul>'); inUl = false; }

    if (trimmed === '') {
      result.push('<div class="bubble-spacer"></div>');
    } else {
      result.push(`<p class="bubble-p">${line}</p>`);
    }
  }

  if (inOl) result.push('</ol>');
  if (inUl) result.push('</ul>');

  let output = result.join('\n');

  // 6. Restore code blocks with styled header and copy button
  output = output.replace(/___CODE_BLOCK_(\d+)___/g, (match, idx) => {
    const item = codeBlocks[idx];
    const safeCode = escapeHtml(item.code);
    return `
      <div class="code-snippet-box">
        <div class="code-snippet-header">
          <span class="code-snippet-lang">${escapeHtml(item.lang)}</span>
          <button type="button" class="code-copy-btn" onclick="copySnippetToClipboard(this)">Copy</button>
        </div>
        <pre class="code-snippet-pre"><code>${safeCode}</code></pre>
      </div>
    `;
  });

  return output;
}

// ============================================================================
// Render: Overview View
// ============================================================================
function renderOverview() {
  const greetingEl = document.getElementById('overviewGreeting');
  const dateEl = document.getElementById('overviewDate');
  const summaryLineEl = document.getElementById('overviewDailySummary');
  const now = new Date();

  // Dynamic Greeting based on time with subtle emoji
  const hour = now.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';
  if (greetingEl) greetingEl.textContent = greeting;

  // Formatted Date
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', dateOptions);

  // Exact Workload Metrics
  const total = state.tasks.length;
  const completedTasks = state.tasks.filter(t => t.completed);
  const pendingTasks = state.tasks.filter(t => !t.completed);
  const pendingMinutes = pendingTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || parseEstimateToMinutes(t.timeEstimate)),
    0
  );
  const rate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

  // Dynamic Daily Summary Sentence
  if (summaryLineEl) {
    if (pendingTasks.length === 0) {
      summaryLineEl.textContent = total > 0
        ? 'All tasks are complete for today. Excellent work!'
        : 'Your task list is clear. Add a task or ask the assistant to plan your day.';
    } else {
      const highCount = pendingTasks.filter(t => t.priority === 'High').length;
      if (highCount > 0) {
        summaryLineEl.textContent = `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'}, including ${highCount} high-priority item${highCount === 1 ? '' : 's'}.`;
      } else {
        summaryLineEl.textContent = `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'} scheduled.`;
      }
    }
  }

  // Metric Cards
  document.getElementById('metricTotalTasks').textContent = total;
  document.getElementById('metricTotalHint').textContent = `${pendingTasks.length} active, ${completedTasks.length} completed`;
  document.getElementById('metricCompletedFraction').textContent = `${completedTasks.length} of ${total} completed`;
  document.getElementById('metricCompletedRate').textContent = `${rate}%`;
  document.getElementById('metricProgressFill').style.width = `${rate}%`;
  document.getElementById('metricFocusTime').textContent = formatDurationRemaining(pendingMinutes);

  // Today's Priorities
  renderOverviewPriorities(pendingTasks);

  // Your Plan
  renderOverviewPlan();
}

function renderOverviewPriorities(pendingTasks) {
  const container = document.getElementById('overviewPrioritiesContainer');
  if (!container) return;

  if (pendingTasks.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px 0; text-align: center; color: var(--text-muted); font-size: var(--font-supporting);">
        <p style="margin-bottom: 8px;">🎉 All tasks are complete. No pending priorities for today.</p>
        <button class="btn btn-secondary btn-sm" onclick="openAddTaskModal()">+ Add a new task</button>
      </div>
    `;
    return;
  }

  // Sort by priority (High first) and due date
  const pOrder = { High: 3, Medium: 2, Low: 1 };
  const sorted = [...pendingTasks].sort((a, b) => {
    if (pOrder[b.priority] !== pOrder[a.priority]) {
      return pOrder[b.priority] - pOrder[a.priority];
    }
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  const top3 = sorted.slice(0, 3);
  const today = fmtDate(new Date());

  container.innerHTML = top3.map((task) => {
    let dueLabel = 'No due date';
    let dueClass = '';
    if (task.dueDate) {
      if (task.dueDate === today) {
        dueLabel = 'Due today';
        dueClass = 'due-today';
      } else if (task.dueDate === tomorrowStr) {
        dueLabel = 'Due tomorrow';
      } else if (task.dueDate < today) {
        dueLabel = `Overdue: ${task.dueDate}`;
        dueClass = 'due-overdue';
      } else {
        dueLabel = `Due: ${task.dueDate}`;
      }
    }

    return `
      <div class="priority-item-row">
        <div class="priority-item-left">
          <input 
            type="checkbox" 
            class="task-checkbox-input"
            ${task.completed ? 'checked' : ''} 
            onchange="toggleTaskCompletion('${task.id}')"
            title="Mark as complete"
          />
          <div class="priority-details">
            <span class="priority-task-name">${escapeHtml(task.title)}</span>
            <div class="priority-task-meta">
              <span class="badge-priority ${task.priority}">${task.priority}</span>
              <span class="badge-category cat-${task.category}">${task.category}</span>
              <span class="badge-due ${dueClass}">📅 ${dueLabel}</span>
              <span>· ⏱️ ${task.timeEstimate || '30m'}</span>
            </div>
          </div>
        </div>
        <div class="priority-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditTaskModal('${task.id}')">Edit</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderOverviewPlan() {
  const container = document.getElementById('overviewPlanContainer');
  const actionsEl = document.getElementById('overviewPlanActions');
  if (!container) return;

  if (!state.currentPlan || !state.currentPlan.days || state.currentPlan.days.length === 0) {
    if (actionsEl) actionsEl.innerHTML = '';
    container.innerHTML = `
      <div class="compact-empty-plan">
        <h3>Ready to organize your day?</h3>
        <p>Build a focused daily schedule or revision roadmap based on your tasks.</p>
        <div class="compact-plan-actions">
          <button class="btn btn-primary btn-sm" id="emptyCreatePlanBtn">Create a plan</button>
          <button class="btn btn-secondary btn-sm" id="emptyAddTaskBtn">Add a task</button>
        </div>
      </div>
    `;

    document.getElementById('emptyCreatePlanBtn')?.addEventListener('click', () => {
      handleChatSubmit('Help me plan my day.');
    });
    document.getElementById('emptyAddTaskBtn')?.addEventListener('click', openAddTaskModal);
    return;
  }

  const plan = state.currentPlan;
  const day1 = plan.days[0];

  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="switchMainView('viewPlans')">View full plan</button>
    `;
  }

  container.innerHTML = `
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: baseline;">
      <div>
        <strong style="color: var(--text);">${escapeHtml(plan.title || 'Today’s Plan')}</strong>
        <span style="font-size: var(--font-micro); color: var(--text-muted); margin-left: 8px;">${escapeHtml(day1.theme || '')}</span>
      </div>
      <span style="font-size: var(--font-micro); color: var(--primary);">${day1.items ? day1.items.length : 0} scheduled activities</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${(day1.items || []).slice(0, 4).map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 12px; font-size: var(--font-supporting);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 700; color: var(--primary); font-size: var(--font-micro);">${escapeHtml(item.time || 'Upcoming')}</span>
            <span style="color: var(--text);">${escapeHtml(item.activity)}</span>
          </div>
          <span style="font-size: var(--font-micro); color: var(--text-muted);">${escapeHtml(item.duration || '30m')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// Render: My Tasks View
// ============================================================================
function renderTasksView() {
  const container = document.getElementById('mainTaskList');
  const footerCounter = document.getElementById('tasksFooterCounter');
  if (!container) return;

  let filtered = [...state.tasks];

  // Status Filter
  if (state.taskFilter === 'pending') {
    filtered = filtered.filter(t => !t.completed);
  } else if (state.taskFilter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }

  // Search Filter
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  }

  // Sort Filter
  if (state.taskSort === 'priority') {
    const pOrder = { High: 3, Medium: 2, Low: 1 };
    filtered.sort((a, b) => pOrder[b.priority] - pOrder[a.priority]);
  } else if (state.taskSort === 'dueDate') {
    filtered.sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  } else if (state.taskSort === 'name') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  const today = fmtDate(new Date());
  const pendingCount = state.tasks.filter(t => !t.completed).length;
  const completedCount = state.tasks.filter(t => t.completed).length;

  // Update filter buttons with real counts
  const allBtn = document.querySelector('#taskStatusFilters [data-filter="all"]');
  const pendingBtn = document.querySelector('#taskStatusFilters [data-filter="pending"]');
  const completedBtn = document.querySelector('#taskStatusFilters [data-filter="completed"]');
  if (allBtn) allBtn.textContent = `All (${state.tasks.length})`;
  if (pendingBtn) pendingBtn.textContent = `Pending (${pendingCount})`;
  if (completedBtn) completedBtn.textContent = `Completed (${completedCount})`;

  if (footerCounter) {
    footerCounter.textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'} displayed (${pendingCount} pending)`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);">
        <p style="color: var(--text-muted); font-size: var(--font-body); margin-bottom: 12px;">Your task list is clear. Add a task to get started.</p>
        <button class="btn btn-secondary btn-sm" onclick="openAddTaskModal()">+ Add task</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(task => {
    const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
    let dueLabel = 'No due date';
    let dueClass = '';
    if (task.dueDate) {
      if (task.dueDate === today) {
        dueLabel = 'Due today';
        dueClass = 'due-today';
      } else if (task.dueDate === tomorrowStr) {
        dueLabel = 'Due tomorrow';
      } else if (isOverdue) {
        dueLabel = `Overdue: ${task.dueDate}`;
        dueClass = 'due-overdue';
      } else {
        dueLabel = `Due: ${task.dueDate}`;
      }
    }

    return `
      <div class="task-item-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-item-left">
          <input 
            type="checkbox" 
            class="task-checkbox-input" 
            ${task.completed ? 'checked' : ''} 
            onchange="toggleTaskCompletion('${task.id}')"
            title="Mark as complete"
          />
          <div class="task-content-block">
            <span class="task-title-text">${escapeHtml(task.title)}</span>
            ${task.description ? `<span class="task-desc-text">${escapeHtml(task.description)}</span>` : ''}
            <div class="task-meta-row">
              <span class="badge-priority ${task.priority}">${task.priority}</span>
              <span class="badge-category cat-${task.category}">${task.category}</span>
              <span>⏱️ ${task.timeEstimate || '30m'}</span>
              ${task.dueDate ? `
                <span class="badge-due ${dueClass}">
                  📅 ${dueLabel}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="task-actions-row">
          <button class="btn btn-ghost btn-sm" onclick="openEditTaskModal('${task.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDeleteTask('${task.id}')" style="color: var(--danger);">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// Render: My Plans View (with Smart Schedule Conflict Detection)
// ============================================================================
function renderPlansView() {
  const titleEl = document.getElementById('plansViewTitle');
  const summaryEl = document.getElementById('plansViewSummary');
  const dayTabsContainer = document.getElementById('plansDayTabs');
  const timelineContainer = document.getElementById('plansTimelineContainer');
  const convertAllBtn = document.getElementById('convertAllPlanTasksBtn');
  const conflictBanner = document.getElementById('scheduleConflictBanner');

  // Check Schedule Conflict (Differentiator Feature)
  const pendingTasks = state.tasks.filter(t => !t.completed);
  const totalMins = pendingTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || parseEstimateToMinutes(t.timeEstimate)),
    0
  );
  const availableHours = 3; // Default workday target

  if (totalMins > availableHours * 60) {
    const diffMins = totalMins - availableHours * 60;
    const diffH = Math.floor(diffMins / 60);
    const diffM = diffMins % 60;
    const diffStr = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`;
    const totalStr = formatDurationRemaining(totalMins).replace(' remaining', '');

    if (conflictBanner) {
      document.getElementById('conflictMessage').textContent =
        `Your tasks require approximately ${totalStr}, but you have ${availableHours} hours available. You're short by ${diffStr}.`;
      conflictBanner.classList.remove('hidden');
    }
  } else {
    conflictBanner?.classList.add('hidden');
  }

  if (!state.currentPlan || !state.currentPlan.days || state.currentPlan.days.length === 0) {
    if (titleEl) titleEl.textContent = 'My Plans';
    if (summaryEl) summaryEl.textContent = 'Structured daily itineraries and exam revision schedules.';
    if (dayTabsContainer) dayTabsContainer.style.display = 'none';
    if (convertAllBtn) convertAllBtn.style.display = 'none';
    if (timelineContainer) {
      timelineContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);">
          <h3 style="font-size: var(--font-card-heading); margin-bottom: 6px;">No Active Plan Created</h3>
          <p style="color: var(--text-muted); font-size: var(--font-supporting); margin-bottom: 16px;">
            LifePilot can build a daily itinerary from your tasks or a multi-day exam roadmap.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-primary btn-sm" onclick="handleChatSubmit('Help me plan my day.')">
              Plan My Day
            </button>
            <button class="btn btn-secondary btn-sm" onclick="handleChatSubmit('I have five days to prepare for my Java examination. I can study two hours daily.')">
              5-Day Java Study Plan
            </button>
          </div>
        </div>
      `;
    }
    return;
  }

  const plan = state.currentPlan;
  if (titleEl) titleEl.textContent = plan.title || 'Productivity Schedule';
  if (summaryEl) summaryEl.textContent = plan.summary || 'Structured activities designed for focused progress.';
  if (convertAllBtn) convertAllBtn.style.display = 'inline-flex';

  // Multi-day tabs
  if (plan.days.length > 1) {
    dayTabsContainer.style.display = 'flex';
    dayTabsContainer.innerHTML = plan.days.map((d, idx) => {
      const dayNum = d.day || (idx + 1);
      return `
        <button 
          class="day-tab-chip ${state.activePlanDay === dayNum ? 'active' : ''}" 
          onclick="switchPlanDay(${dayNum})"
        >
          Day ${dayNum}
        </button>
      `;
    }).join('');
  } else {
    dayTabsContainer.style.display = 'none';
  }

  const currentDayObj = plan.days.find(d => (d.day || 1) === state.activePlanDay) || plan.days[0];

  if (!currentDayObj || !currentDayObj.items || currentDayObj.items.length === 0) {
    timelineContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        No schedule items recorded for Day ${state.activePlanDay}.
      </div>
    `;
    return;
  }

  timelineContainer.innerHTML = `
    ${currentDayObj.theme ? `
      <div style="font-size: var(--font-supporting); font-weight: 700; color: var(--primary); margin-bottom: 4px;">
        Day ${currentDayObj.day || 1} Theme: ${escapeHtml(currentDayObj.theme)}
      </div>
    ` : ''}
    ${currentDayObj.items.map((item, idx) => `
      <div class="timeline-entry-card">
        <div class="timeline-entry-left">
          <span class="timeline-time-col">${escapeHtml(item.time || 'Scheduled')}</span>
          <div class="timeline-entry-info">
            <h4>${escapeHtml(item.activity)}</h4>
            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
            <div class="timeline-entry-tags">
              <span class="badge-category">${escapeHtml(item.category || 'Study')}</span>
              ${item.duration ? `<span class="badge-category">⏱️ ${escapeHtml(item.duration)}</span>` : ''}
            </div>
          </div>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="convertPlanItemToTask(${state.activePlanDay}, ${idx})" title="Add to task board">
            + Add to tasks
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

window.switchPlanDay = function(dayNum) {
  state.activePlanDay = dayNum;
  renderPlansView();
};

// ============================================================================
// Render: Priorities (Eisenhower Matrix)
// ============================================================================
function renderPrioritiesView() {
  const pending = state.tasks.filter(t => !t.completed);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const q1 = [];
  const q2 = [];
  const q3 = [];
  const q4 = [];

  pending.forEach(task => {
    const isHigh = task.priority === 'High';
    let isUrgent = false;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) isUrgent = true;
    }

    if (isHigh && isUrgent) q1.push(task);
    else if (isHigh || (!isUrgent && task.priority === 'Medium')) q2.push(task);
    else if (isUrgent) q3.push(task);
    else q4.push(task);
  });

  const renderQuad = (listId, badgeId, items) => {
    const listEl = document.getElementById(listId);
    const badgeEl = document.getElementById(badgeId);
    if (badgeEl) badgeEl.textContent = items.length;
    if (listEl) {
      if (items.length === 0) {
        listEl.innerHTML = `<li style="color: var(--text-subtle); font-size: var(--font-micro); padding: 12px 0; text-align: center;">No active items</li>`;
      } else {
        listEl.innerHTML = items.map(t => `
          <li class="matrix-task-item">
            <div class="matrix-task-left">
              <input 
                type="checkbox" 
                class="task-checkbox-input" 
                onchange="toggleTaskCompletion('${t.id}')"
                title="Mark as complete"
              />
              <span class="matrix-task-title">${escapeHtml(t.title)}</span>
            </div>
            <select onchange="reclassifyTaskPriority('${t.id}', this.value)" class="matrix-priority-select" title="Move quadrant">
              <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
          </li>
        `).join('');
      }
    }
  };

  renderQuad('listQ1', 'badgeQ1', q1);
  renderQuad('listQ2', 'badgeQ2', q2);
  renderQuad('listQ3', 'badgeQ3', q3);
  renderQuad('listQ4', 'badgeQ4', q4);
}

window.reclassifyTaskPriority = function(taskId, newPriority) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.priority = newPriority;
    saveTasksToStorage();
    showToast(`Updated "${task.title}" to ${newPriority} priority`, 'info');
  }
};

// ============================================================================
// Render: Conversation History Stream (with Action Buttons)
// ============================================================================
function renderConversationStream() {
  const stream = document.getElementById('conversationStream');
  if (!stream) return;

  stream.innerHTML = state.conversationHistory.map((msg, index) => {
    const isUser = msg.sender === 'user';
    const timeLabel = msg.time || '';

    // Render interactive action buttons if present
    let actionButtonsHtml = '';
    if (!isUser && msg.actions && Array.isArray(msg.actions) && msg.actions.length > 0) {
      actionButtonsHtml = `
        <div class="bubble-action-row">
          ${msg.actions.map(act => {
            let icon = '⚡';
            if (act.type.includes('plan')) icon = '🗓️';
            else if (act.type.includes('priorit')) icon = '📊';
            else if (act.type.includes('task')) icon = '➕';
            return `
              <button class="bubble-action-btn" onclick="executeAssistantAction('${escapeHtml(act.type)}')">
                <span>${icon}</span>
                <span>${escapeHtml(act.label)}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="chat-turn ${isUser ? 'user' : 'assistant'}">
        <div class="turn-meta">${isUser ? 'You' : 'LifePilot'}${timeLabel ? ` · ${timeLabel}` : ''}</div>
        <div class="turn-bubble">
          ${formatMarkdown(msg.text)}
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  }).join('');

  stream.scrollTop = stream.scrollHeight;
}

// Master Render Function
function renderAllViews() {
  renderOverview();
  renderTasksView();
  renderPlansView();
  renderPrioritiesView();
}

// ============================================================================
// Assistant Action Buttons Execution
// ============================================================================
window.executeAssistantAction = function(actionType) {
  if (actionType === 'create_plan' || actionType === 'accept_plan') {
    handleChatSubmit('Help me plan my day.');
    switchMainView('viewPlans');
  } else if (actionType === 'view_priorities' || actionType === 'prompt_prioritize') {
    switchMainView('viewPriorities');
  } else if (actionType === 'view_tasks') {
    switchMainView('viewTasks');
  } else if (actionType === 'view_plans') {
    switchMainView('viewPlans');
  } else if (actionType === 'convert_all_tasks') {
    convertAllPlanItemsToTasks();
  } else if (actionType === 'open_add_task') {
    openAddTaskModal();
  } else if (actionType === 'create_study_plan') {
    handleChatSubmit('I have five days to prepare for my Java examination. I can study two hours daily.');
  }
};

// ============================================================================
// Navigation: Switching Views
// ============================================================================
window.switchMainView = function(viewId) {
  state.activeView = viewId;

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });

  document.querySelectorAll('.workspace-view').forEach(view => {
    view.classList.toggle('active', view.id === viewId);
  });

  const assistantCol = document.getElementById('assistantColumn');
  const workspaceCol = document.getElementById('workspaceColumn');
  if (window.innerWidth <= 900) {
    assistantCol?.classList.remove('active');
    workspaceCol?.classList.add('active');
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mobileView === 'workspace');
    });
  }
};

// ============================================================================
// Task CRUD Operations
// ============================================================================
window.toggleTaskCompletion = function(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasksToStorage();
    showToast(task.completed ? `Completed "${task.title}"` : `Marked "${task.title}" as pending`, 'success');
  }
};

window.confirmDeleteTask = function(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    saveTasksToStorage();
    showToast(`Deleted "${task.title}"`, 'info');
  }
};

function openAddTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'Add Task';
  document.getElementById('taskEditId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskPriority').value = 'Medium';
  document.getElementById('taskCategory').value = 'Study';
  document.getElementById('taskDueDate').value = tomorrowStr;
  document.getElementById('taskEstimate').value = '45m';

  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskTitle').focus();
}

window.openEditTaskModal = function(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskEditId').value = task.id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskCategory').value = task.category;
  document.getElementById('taskDueDate').value = task.dueDate || '';
  document.getElementById('taskEstimate').value = task.timeEstimate || '45m';

  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('taskTitle').focus();
};

function closeTaskModal() {
  document.getElementById('taskModal').classList.add('hidden');
}

// Plan Activities to Task Conversion
window.convertPlanItemToTask = function(dayNum, itemIndex) {
  if (!state.currentPlan || !state.currentPlan.days) return;
  const dayObj = state.currentPlan.days.find(d => (d.day || 1) === dayNum);
  if (!dayObj || !dayObj.items || !dayObj.items[itemIndex]) return;

  const item = dayObj.items[itemIndex];
  state.tasks.unshift({
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: `Day ${dayNum}: ${item.activity}`,
    description: item.description || '',
    priority: 'High',
    category: item.category || 'Study',
    timeEstimate: item.duration || '60m',
    estimatedMinutes: parseEstimateToMinutes(item.duration || '60m'),
    dueDate: todayStr,
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasksToStorage();
  showToast(`Added "${item.activity}" to your task board`, 'success');
};

function convertAllPlanItemsToTasks() {
  if (!state.currentPlan || !state.currentPlan.days) return;
  let count = 0;

  state.currentPlan.days.forEach(day => {
    const dayNum = day.day || 1;
    (day.items || []).forEach(item => {
      state.tasks.unshift({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: `Day ${dayNum}: ${item.activity}`,
        description: item.description || '',
        priority: 'High',
        category: item.category || 'Study',
        timeEstimate: item.duration || '60m',
        estimatedMinutes: parseEstimateToMinutes(item.duration || '60m'),
        dueDate: todayStr,
        completed: false,
        createdAt: new Date().toISOString()
      });
      count++;
    });
  });

  saveTasksToStorage();
  switchMainView('viewTasks');
  showToast(`Added ${count} plan activities into your active tasks!`, 'success');
}

// ============================================================================
// Assistant Interaction: Chat & API Dispatch
// ============================================================================
async function handleChatSubmit(userMessage) {
  if (!userMessage || !userMessage.trim()) return;

  const inputEl = document.getElementById('composerInput');
  const sendBtn = document.getElementById('sendBtn');
  const processingIndicator = document.getElementById('aiProcessingIndicator');
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Append user message
  state.conversationHistory.push({
    sender: 'user',
    text: userMessage.trim(),
    time: timeStr
  });
  saveHistoryToStorage();

  if (inputEl) inputEl.value = '';
  if (sendBtn) sendBtn.disabled = true;

  // Processing state
  processingIndicator?.classList.remove('hidden');
  updateAiStatusBadge('processing', 'AI Processing');

  state.activeAbortController = new AbortController();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: state.activeAbortController.signal,
      body: JSON.stringify({
        message: userMessage,
        tasks: state.tasks, // Current tasks sent as single source of truth!
        history: state.conversationHistory
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Server error occurred');

    const result = data.data;

    // Append assistant response with actions
    state.conversationHistory.push({
      sender: 'assistant',
      text: result.reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: result.structuredData?.actions || []
    });
    saveHistoryToStorage();

    // Handle structured tasks and plans
    if (result.structuredData) {
      if (result.structuredData.tasks && result.structuredData.tasks.length > 0) {
        result.structuredData.tasks.forEach(raw => {
          state.tasks.unshift({
            id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: raw.title,
            description: raw.description || '',
            priority: raw.priority || 'Medium',
            category: raw.category || 'Study',
            dueDate: raw.dueDate || null,
            timeEstimate: raw.timeEstimate || '45m',
            estimatedMinutes: parseEstimateToMinutes(raw.timeEstimate || '45m'),
            completed: false,
            createdAt: new Date().toISOString()
          });
        });
        saveTasksToStorage();
      }

      if (result.structuredData.plan) {
        state.currentPlan = result.structuredData.plan;
        state.activePlanDay = 1;
        savePlanToStorage();
        switchMainView('viewPlans');
      }
    }

    if (state.ttsEnabled) {
      speakAssistantReply(result.reply);
    }

    updateAiStatusBadge(result.serviceStatus, result.serviceLabel);

  } catch (err) {
    if (err.name === 'AbortError') {
      state.conversationHistory.push({
        sender: 'assistant',
        text: 'Request was cancelled.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } else {
      console.error('Chat submit error:', err);
      state.conversationHistory.push({
        sender: 'assistant',
        text: `LifePilot couldn't generate a plan right now. ${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { type: 'create_plan', label: 'Try again with local demo' }
        ]
      });
      updateAiStatusBadge('offline', 'AI Unavailable');
    }
    saveHistoryToStorage();
  } finally {
    processingIndicator?.classList.add('hidden');
    if (sendBtn) sendBtn.disabled = false;
    state.activeAbortController = null;
  }
}

// Cancel Request Handler
function cancelActiveRequest() {
  if (state.activeAbortController) {
    state.activeAbortController.abort();
  }
}

// ============================================================================
// Voice Interaction (STT & TTS)
// ============================================================================
let speechRecognition = null;

function setupSpeechCapabilities() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('micBtn');
  const banner = document.getElementById('voiceIndicatorBanner');
  const bannerText = document.getElementById('voiceStatusText');
  const cancelBtn = document.getElementById('voiceCancelBtn');

  if (!SpeechRec) {
    if (micBtn) {
      micBtn.style.opacity = '0.35';
      micBtn.title = 'Voice input is not supported in this browser.';
    }
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onstart = () => {
    state.isListening = true;
    micBtn.classList.add('active');
    banner.classList.remove('hidden');
    bannerText.textContent = 'Listening to your voice... Speak now';
  };

  speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('composerInput').value = transcript;
    bannerText.textContent = `"${transcript}"`;
  };

  speechRecognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopVoiceListening();
  };

  speechRecognition.onend = () => {
    stopVoiceListening();
    const text = document.getElementById('composerInput').value.trim();
    if (text) {
      handleChatSubmit(text);
    }
  };

  micBtn.addEventListener('click', () => {
    if (state.isListening) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (e) {
        console.error('Recognition error:', e);
      }
    }
  });

  cancelBtn?.addEventListener('click', () => {
    if (speechRecognition) speechRecognition.abort();
    stopVoiceListening();
    document.getElementById('composerInput').value = '';
  });
}

function stopVoiceListening() {
  state.isListening = false;
  document.getElementById('micBtn')?.classList.remove('active');
  document.getElementById('voiceIndicatorBanner')?.classList.add('hidden');
}

function speakAssistantReply(text) {
  if (!state.ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*_#`•]/g, '').trim();
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ============================================================================
// Dynamic AI Status Check
// ============================================================================
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    updateAiStatusBadge(data.aiStatus, data.aiStatusLabel);

    const diagCurrent = document.getElementById('diagCurrentStatus');
    if (diagCurrent) diagCurrent.textContent = data.aiStatusLabel || 'Demo Mode';

    const currentBadge = document.getElementById('settingsCurrentBadge');
    if (currentBadge) {
      currentBadge.className = `settings-status-badge status-${data.aiStatus || 'demo'}`;
      currentBadge.textContent = data.aiStatus === 'connected' ? 'Bedrock Connected' : (data.aiStatus === 'offline' ? 'Offline' : 'Demo Mode');
    }

    const diagRegion = document.getElementById('diagAwsRegion');
    if (diagRegion) diagRegion.textContent = data.awsBedrock?.region || 'us-east-1';

    const diagModel = document.getElementById('diagAwsModel');
    if (diagModel) diagModel.textContent = data.awsBedrock?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

    const diagUptime = document.getElementById('diagServerUptime');
    if (diagUptime) diagUptime.textContent = data.serverUptime || (data.uptime ? `${data.uptime}s` : '0s');

    const diagLastReq = document.getElementById('diagLastRequest');
    if (diagLastReq) {
      if (data.awsBedrock?.lastSuccessfulRequest) {
        diagLastReq.textContent = new Date(data.awsBedrock.lastSuccessfulRequest).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      } else {
        diagLastReq.textContent = 'None yet in this session';
      }
    }

    const credsEl = document.getElementById('diagCredsStatus');
    if (credsEl) {
      if (data.awsBedrock?.configured) {
        credsEl.textContent = 'Configured in .env';
        credsEl.style.color = 'var(--success)';
      } else {
        credsEl.textContent = 'Not detected in .env (Demo Mode)';
        credsEl.style.color = 'var(--text-muted)';
      }
    }
  } catch (err) {
    updateAiStatusBadge('offline', 'AI Unavailable');
    const currentBadge = document.getElementById('settingsCurrentBadge');
    if (currentBadge) {
      currentBadge.className = 'settings-status-badge status-offline';
      currentBadge.textContent = 'Offline';
    }
    const diagCurrent = document.getElementById('diagCurrentStatus');
    if (diagCurrent) diagCurrent.textContent = 'AI Offline · Service Unreachable';
  }
}

function updateAiStatusBadge(statusKey, label) {
  state.aiStatus = statusKey;
  state.aiStatusLabel = label;

  const pill = document.getElementById('aiStatusPill');
  const labelEl = document.getElementById('aiStatusLabel');

  if (pill) {
    pill.className = `ai-status-pill status-${statusKey}`;
  }
  if (labelEl) {
    labelEl.textContent = label;
  }
}

async function testBedrockHandshake() {
  const btn = document.getElementById('testAwsConnectionBtn');
  const retryBtn = document.getElementById('retryConnectionBtn');
  const box = document.getElementById('testFeedbackBox');

  if (btn) btn.disabled = true;
  if (retryBtn) retryBtn.disabled = true;

  if (box) {
    box.className = 'test-feedback-box';
    box.textContent = 'Testing AWS Bedrock connection and invoking model...';
    box.classList.remove('hidden');
  }

  try {
    const res = await fetch('/api/test-bedrock', { method: 'POST' });
    const json = await res.json();
    const data = json.data;

    // Refresh uptime if returned
    if (data.serverUptime) {
      const diagUptime = document.getElementById('diagServerUptime');
      if (diagUptime) diagUptime.textContent = data.serverUptime;
    }

    if (data.connected) {
      if (box) {
        box.className = 'test-feedback-box success';
        box.innerHTML = `
          <strong>✓ Amazon Bedrock Connected</strong><br>
          Region: <code>${escapeHtml(data.region)}</code> · Latency: ${data.latencyMs}ms<br>
          Model: <code>${escapeHtml(data.modelId)}</code><br>
          Verification reply: "<em>${escapeHtml(data.reply ? data.reply.trim() : 'Active')}</em>"
        `;
      }
      updateAiStatusBadge('connected', 'Amazon Bedrock Connected');
      const diagCurrent = document.getElementById('diagCurrentStatus');
      if (diagCurrent) diagCurrent.textContent = 'Amazon Bedrock Connected';

      const currentBadge = document.getElementById('settingsCurrentBadge');
      if (currentBadge) {
        currentBadge.className = 'settings-status-badge status-connected';
        currentBadge.textContent = 'Bedrock Connected';
      }

      const diagLastReq = document.getElementById('diagLastRequest');
      if (diagLastReq && data.lastSuccessfulRequest) {
        diagLastReq.textContent = new Date(data.lastSuccessfulRequest).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    } else {
      if (box) {
        box.className = 'test-feedback-box error';
        const troubleHtml = data.troubleshooting
          ? `<div class="test-feedback-trouble"><strong>Guidance:</strong> ${escapeHtml(data.troubleshooting)}</div>`
          : '';
        box.innerHTML = `
          <strong>✕ ${escapeHtml(data.statusLabel || 'Connection Test Failed')}</strong><br>
          <span>${escapeHtml(data.error || data.message || 'Check IAM keys and Bedrock Model Access.')}</span>
          ${troubleHtml}
        `;
      }
      updateAiStatusBadge(data.configured ? 'offline' : 'demo', data.statusLabel || 'Demo Mode · Sample Responses');
      const diagCurrent = document.getElementById('diagCurrentStatus');
      if (diagCurrent) diagCurrent.textContent = data.statusLabel || 'Demo Mode · Sample Responses';

      const currentBadge = document.getElementById('settingsCurrentBadge');
      if (currentBadge) {
        currentBadge.className = `settings-status-badge ${data.configured ? 'status-offline' : 'status-demo'}`;
        currentBadge.textContent = data.configured ? 'Offline' : 'Demo Mode';
      }
    }
  } catch (e) {
    if (box) {
      box.className = 'test-feedback-box error';
      box.textContent = `Request error: ${e.message}`;
    }
    updateAiStatusBadge('offline', 'AI Unavailable');
    const currentBadge = document.getElementById('settingsCurrentBadge');
    if (currentBadge) {
      currentBadge.className = 'settings-status-badge status-offline';
      currentBadge.textContent = 'Offline';
    }
  } finally {
    if (btn) btn.disabled = false;
    if (retryBtn) retryBtn.disabled = false;
  }
}

// ============================================================================
// Event Listeners Initialization
// ============================================================================
function initializeEventListeners() {
  // Navigation Tabs in Header
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchMainView(tab.dataset.view);
    });
  });

  // Mobile Navigation Switcher
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.mobileView;
      const assistantCol = document.getElementById('assistantColumn');
      const workspaceCol = document.getElementById('workspaceColumn');

      if (target === 'assistant') {
        assistantCol?.classList.add('active');
        workspaceCol?.classList.remove('active');
      } else {
        assistantCol?.classList.remove('active');
        workspaceCol?.classList.add('active');
      }
    });
  });

  // Prompt Pills
  document.querySelectorAll('.prompt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      handleChatSubmit(pill.dataset.prompt);
    });
  });

  // Composer Form
  const composerForm = document.getElementById('composerForm');
  const composerInput = document.getElementById('composerInput');

  composerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (composerInput) handleChatSubmit(composerInput.value);
  });

  if (composerInput) {
    composerInput.addEventListener('input', () => {
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px';
    });

    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleChatSubmit(composerInput.value);
      }
    });
  }

  // Cancel Request Button
  document.getElementById('cancelRequestBtn')?.addEventListener('click', cancelActiveRequest);

  // Overview quick actions
  document.getElementById('overviewViewAllTasksBtn')?.addEventListener('click', () => {
    switchMainView('viewTasks');
  });

  document.getElementById('overviewNewPlanBtn')?.addEventListener('click', () => {
    document.getElementById('planModal').classList.remove('hidden');
  });

  // Task Filters & Search
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.taskFilter = tab.dataset.filter;
      renderTasksView();
    });
  });

  document.getElementById('taskSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTasksView();
  });

  document.getElementById('taskSortSelect')?.addEventListener('change', (e) => {
    state.taskSort = e.target.value;
    renderTasksView();
  });

  // Task modal open & reset
  document.getElementById('openAddTaskBtn')?.addEventListener('click', openAddTaskModal);

  document.getElementById('clearCompletedTasksBtn')?.addEventListener('click', () => {
    const count = state.tasks.filter(t => t.completed).length;
    state.tasks = state.tasks.filter(t => !t.completed);
    saveTasksToStorage();
    showToast(count > 0 ? `Cleared ${count} completed tasks` : 'No completed tasks to clear', 'info');
  });

  document.getElementById('loadSampleTasksBtn')?.addEventListener('click', () => {
    state.tasks = JSON.parse(JSON.stringify(INITIAL_SHARED_TASKS));
    saveTasksToStorage();
    showToast('Reset sample task list', 'info');
  });

  // Task Form Submit (Add or Edit)
  const taskForm = document.getElementById('taskForm');
  taskForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('taskEditId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const category = document.getElementById('taskCategory').value;
    const dueDate = document.getElementById('taskDueDate').value || null;
    const timeEstimate = document.getElementById('taskEstimate').value.trim() || '45m';

    if (!title) return;

    if (editId) {
      const existing = state.tasks.find(t => t.id === editId);
      if (existing) {
        existing.title = title;
        existing.description = description;
        existing.priority = priority;
        existing.category = category;
        existing.dueDate = dueDate;
        existing.timeEstimate = timeEstimate;
        existing.estimatedMinutes = parseEstimateToMinutes(timeEstimate);
      }
    } else {
      state.tasks.unshift({
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title,
        description,
        priority,
        category,
        dueDate,
        timeEstimate,
        estimatedMinutes: parseEstimateToMinutes(timeEstimate),
        completed: false,
        createdAt: new Date().toISOString()
      });
    }

    saveTasksToStorage();
    closeTaskModal();
    showToast(editId ? `Updated "${title}"` : `Added "${title}" to your tasks!`, 'success');
  });

  document.getElementById('closeTaskModalBtn')?.addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskModalBtn')?.addEventListener('click', closeTaskModal);

  // Plans View actions
  document.getElementById('createCustomPlanBtn')?.addEventListener('click', () => {
    document.getElementById('planModal').classList.remove('hidden');
  });

  document.getElementById('convertAllPlanTasksBtn')?.addEventListener('click', convertAllPlanItemsToTasks);

  // Schedule conflict buttons
  document.getElementById('conflictExtendBtn')?.addEventListener('click', () => {
    document.getElementById('scheduleConflictBanner').classList.add('hidden');
    showToast('Extended daily time allowance. Schedule conflict resolved!', 'success');
  });

  document.getElementById('conflictDismissBtn')?.addEventListener('click', () => {
    document.getElementById('scheduleConflictBanner').classList.add('hidden');
  });

  // Plan Modal Submit
  const planForm = document.getElementById('planForm');
  planForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const goal = document.getElementById('planGoal').value.trim();
    const days = parseInt(document.getElementById('planDays').value, 10) || 5;
    const hours = parseInt(document.getElementById('planDailyHours').value, 10) || 2;

    if (!goal) return;
    document.getElementById('planModal').classList.add('hidden');
    handleChatSubmit(`I have ${days} days to prepare for ${goal}. I can study ${hours} hours daily. Create a structured revision plan.`);
  });

  document.getElementById('closePlanModalBtn')?.addEventListener('click', () => {
    document.getElementById('planModal').classList.add('hidden');
  });
  document.getElementById('cancelPlanModalBtn')?.addEventListener('click', () => {
    document.getElementById('planModal').classList.add('hidden');
  });

  // Priorities AI trigger
  document.getElementById('askAiPrioritizeBtn')?.addEventListener('click', () => {
    handleChatSubmit('What should I prioritize today based on my active tasks?');
  });

  // TTS Toggle
  const ttsBtn = document.getElementById('ttsToggleBtn');
  ttsBtn?.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    ttsBtn.classList.toggle('active', state.ttsEnabled);
    if (!state.ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  // Clear Chat Button
  document.getElementById('clearChatBtn')?.addEventListener('click', () => {
    if (confirm('Start a new conversation? Your task list will be preserved.')) {
      state.conversationHistory = [
        {
          sender: 'assistant',
          text: "Hello! I'm LifePilot. What would you like to accomplish today? Ask me to plan your day, prioritize tasks, or build a study roadmap.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { type: 'create_plan', label: 'Plan my day' },
            { type: 'view_priorities', label: 'Prioritize my tasks' }
          ]
        }
      ];
      saveHistoryToStorage();
      showToast('Started fresh conversation', 'info');
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('taskModal')?.classList.add('hidden');
      document.getElementById('planModal')?.classList.add('hidden');
      document.getElementById('settingsModal')?.classList.add('hidden');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('composerInput')?.focus();
    }
  });

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const aiStatusPill = document.getElementById('aiStatusPill');

  const openSettings = () => {
    checkSystemStatus();
    settingsModal.classList.remove('hidden');
  };
  const closeSettings = () => settingsModal.classList.add('hidden');

  settingsBtn?.addEventListener('click', openSettings);
  aiStatusPill?.addEventListener('click', openSettings);
  document.getElementById('closeSettingsModalBtn')?.addEventListener('click', closeSettings);
  document.getElementById('closeSettingsBottomBtn')?.addEventListener('click', closeSettings);
  document.getElementById('testAwsConnectionBtn')?.addEventListener('click', testBedrockHandshake);
  document.getElementById('retryConnectionBtn')?.addEventListener('click', testBedrockHandshake);
}

// ============================================================================
// Initialization on Load
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  renderAllViews();
  renderConversationStream();
  initializeEventListeners();
  setupSpeechCapabilities();
  checkSystemStatus();
});
