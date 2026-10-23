/**
 * LifePilot AI — Client Application Logic
 * "LifePilot — Make space for what matters."
 */

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
  aiStatusLabel: 'Demo Mode · Sample Responses'
};

// ============================================================================
// Sample Starter Tasks
// ============================================================================
const todayStr = new Date().toISOString().split('T')[0];
const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const inThreeDaysStr = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

const INITIAL_SAMPLE_TASKS = [
  {
    id: 'task_sample_1',
    title: 'Complete Java assignment',
    description: 'OOP inheritance and class hierarchy exercises',
    priority: 'High',
    category: 'Study',
    dueDate: todayStr,
    timeEstimate: '2h',
    estimatedMinutes: 120,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_sample_2',
    title: 'Review lecture notes',
    description: 'Summarize key takeaways from yesterday’s lecture',
    priority: 'Medium',
    category: 'Study',
    dueDate: tomorrowStr,
    timeEstimate: '45m',
    estimatedMinutes: 45,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_sample_3',
    title: 'Practice coding problems',
    description: 'Solve 3 array and string interview questions',
    priority: 'Medium',
    category: 'Coding',
    dueDate: inThreeDaysStr,
    timeEstimate: '1h',
    estimatedMinutes: 60,
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_sample_4',
    title: 'Hydration & 20-minute walk',
    description: 'Midday wellness break',
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

// ============================================================================
// Storage & Persistence
// ============================================================================
function loadStateFromStorage() {
  try {
    const savedTasks = localStorage.getItem('lifepilot_tasks');
    if (savedTasks) {
      state.tasks = JSON.parse(savedTasks);
    } else {
      state.tasks = [...INITIAL_SAMPLE_TASKS];
      saveTasksToStorage();
    }

    const savedPlan = localStorage.getItem('lifepilot_plan');
    if (savedPlan) {
      state.currentPlan = JSON.parse(savedPlan);
    }

    const savedHistory = localStorage.getItem('lifepilot_history');
    if (savedHistory) {
      state.conversationHistory = JSON.parse(savedHistory);
    } else {
      // Clean example conversation
      state.conversationHistory = [
        {
          sender: 'user',
          text: 'Help me plan my day.',
          time: '9:30 AM'
        },
        {
          sender: 'assistant',
          text: `Let's organize your day around your most important tasks. You have one deadline today, so I suggest starting there:

1. **Complete Java assignment** (High priority · Due today)
2. **Review lecture notes** (Medium priority)
3. **Practice coding problems** (Medium priority)

I've organized these priorities on your dashboard. Let me know if you would like to adjust the schedule.`,
          time: '9:30 AM'
        }
      ];
      saveHistoryToStorage();
    }
  } catch (e) {
    console.error('Error loading localStorage state:', e);
    state.tasks = [...INITIAL_SAMPLE_TASKS];
  }
}

function saveTasksToStorage() {
  localStorage.setItem('lifepilot_tasks', JSON.stringify(state.tasks));
  renderAllViews();
}

function savePlanToStorage() {
  if (state.currentPlan) {
    localStorage.setItem('lifepilot_plan', JSON.stringify(state.currentPlan));
  } else {
    localStorage.removeItem('lifepilot_plan');
  }
  renderOverviewPlan();
  renderPlansView();
}

function saveHistoryToStorage() {
  localStorage.setItem('lifepilot_history', JSON.stringify(state.conversationHistory));
  renderConversationStream();
}

// ============================================================================
// Helpers & Calculations
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

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} mins`;
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '');
  return `${hours} hour${hours === '1' ? '' : 's'}`;
}

function getPrioritizationReason(task) {
  if (!task) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!task.dueDate) {
    return task.priority === 'High'
      ? 'Prioritized because it is marked as high importance.'
      : 'Scheduled based on standard workflow priority.';
  }

  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} — requires prompt attention.`;
  }
  if (diffDays === 0) {
    return task.priority === 'High'
      ? 'Prioritized because it is due today and has been marked as high priority.'
      : 'Prioritized because it is due today.';
  }
  if (diffDays === 1) {
    return 'Due tomorrow — scheduled early to maintain momentum.';
  }
  if (diffDays <= 3 && task.priority === 'High') {
    return `Due in ${diffDays} days with high impact on your schedule.`;
  }
  return `Due on ${task.dueDate} under ${task.priority.toLowerCase()} priority.`;
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

function formatMarkdown(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/(?:^|\n)[-*]\s+(.+)/g, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  formatted = formatted.replace(/\n\n/g, '<br><br>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// ============================================================================
// Render: Overview View
// ============================================================================
function renderOverview() {
  const greetingEl = document.getElementById('overviewGreeting');
  const dateEl = document.getElementById('overviewDate');
  const now = new Date();

  // Dynamic Greeting based on current hour
  const hour = now.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';
  if (greetingEl) greetingEl.textContent = greeting;

  // Format Date (e.g. Thursday, October 23)
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);

  // Metrics
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pendingTasks = state.tasks.filter(t => !t.completed);
  const pendingMinutes = pendingTasks.reduce((sum, t) => sum + (t.estimatedMinutes || parseEstimateToMinutes(t.timeEstimate)), 0);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('metricTotalTasks').textContent = total;
  document.getElementById('metricCompletedTasks').textContent = `${completed} of ${total}`;
  document.getElementById('metricCompletedRate').textContent = `${rate}% finished`;
  document.getElementById('metricFocusTime').textContent = formatMinutes(pendingMinutes);

  // Top Priorities (Up to 3 tasks)
  renderOverviewPriorities(pendingTasks);

  // Plan section
  renderOverviewPlan();
}

function renderOverviewPriorities(pendingTasks) {
  const container = document.getElementById('overviewPrioritiesContainer');
  if (!container) return;

  if (pendingTasks.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px 0; text-align: center; color: var(--text-muted); font-size: var(--font-supporting);">
        All tasks are completed. You have a clean slate for today.
      </div>
    `;
    return;
  }

  // Sort: High priority & tight deadlines first
  const sorted = [...pendingTasks].sort((a, b) => {
    const pOrder = { High: 3, Medium: 2, Low: 1 };
    if (pOrder[b.priority] !== pOrder[a.priority]) {
      return pOrder[b.priority] - pOrder[a.priority];
    }
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const top3 = sorted.slice(0, 3);

  container.innerHTML = top3.map((task, index) => {
    const reason = getPrioritizationReason(task);
    return `
      <div class="priority-item-row">
        <div class="priority-item-left">
          <span class="priority-rank">${index + 1}.</span>
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
              <span class="badge-priority ${task.priority}">${task.priority} priority</span>
              ${task.dueDate ? `<span>Due: ${task.dueDate}</span>` : '<span>No deadline</span>'}
              <span>⏱️ ${task.timeEstimate || '30m'}</span>
            </div>
            <div class="priority-reason-text">${escapeHtml(reason)}</div>
          </div>
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
        <h3>Your day starts here.</h3>
        <p>Create a schedule or add a task to get started.</p>
        <div class="compact-plan-actions">
          <button class="btn btn-primary btn-sm" id="emptyCreatePlanBtn">Create today's plan</button>
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

  // Keyword Search
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  }

  // Sort
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

  const today = new Date().toISOString().split('T')[0];
  const pendingCount = state.tasks.filter(t => !t.completed).length;

  if (footerCounter) {
    footerCounter.textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'} displayed (${pendingCount} pending)`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);">
        <p style="color: var(--text-muted); font-size: var(--font-body); margin-bottom: 12px;">No tasks match your current filter.</p>
        <button class="btn btn-secondary btn-sm" onclick="openAddTaskModal()">Add a task</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(task => {
    const isOverdue = !task.completed && task.dueDate && task.dueDate < today;
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
              <span class="badge-category">${task.category}</span>
              <span>⏱️ ${task.timeEstimate || '30m'}</span>
              ${task.dueDate ? `
                <span class="${isOverdue ? 'overdue-indicator' : ''}">
                  📅 ${isOverdue ? 'Overdue: ' : 'Due: '}${task.dueDate}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="task-actions-row">
          <button class="btn btn-ghost btn-sm" onclick="openEditTaskModal('${task.id}')" title="Edit task">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDeleteTask('${task.id}')" title="Delete task" style="color: var(--danger);">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// Render: My Plans View
// ============================================================================
function renderPlansView() {
  const titleEl = document.getElementById('plansViewTitle');
  const summaryEl = document.getElementById('plansViewSummary');
  const dayTabsContainer = document.getElementById('plansDayTabs');
  const timelineContainer = document.getElementById('plansTimelineContainer');
  const convertAllBtn = document.getElementById('convertAllPlanTasksBtn');

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
            LifePilot can build a 5-day study roadmap or an optimized daily itinerary.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-primary btn-sm" onclick="handleChatSubmit('I have five days to prepare for my Java examination. I can study two hours daily.')">
              Try: 5-Day Java Exam Plan
            </button>
            <button class="btn btn-secondary btn-sm" onclick="handleChatSubmit('Help me plan my day.')">
              Try: Plan My Day
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
      if (diffDays <= 2) isUrgent = true;
    }

    if (isHigh && isUrgent) q1.push(task);
    else if (isHigh || (!isUrgent && task.priority === 'Medium')) q2.push(task);
    else if (isUrgent) q3.push(task);
    else q4.push(task);
  });

  const renderQuad = (listId, badgeId, items, defaultCategory) => {
    const listEl = document.getElementById(listId);
    const badgeEl = document.getElementById(badgeId);
    if (badgeEl) badgeEl.textContent = items.length;
    if (listEl) {
      if (items.length === 0) {
        listEl.innerHTML = `<li style="color: var(--text-subtle); font-size: var(--font-micro); padding: 8px 0;">No active tasks</li>`;
      } else {
        listEl.innerHTML = items.map(t => `
          <li class="matrix-task-item">
            <span>${escapeHtml(t.title)}</span>
            <select onchange="reclassifyTaskPriority('${t.id}', this.value)" title="Move quadrant">
              <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
          </li>
        `).join('');
      }
    }
  };

  renderQuad('listQ1', 'badgeQ1', q1, 'Do First');
  renderQuad('listQ2', 'badgeQ2', q2, 'Schedule');
  renderQuad('listQ3', 'badgeQ3', q3, 'Quick Wins');
  renderQuad('listQ4', 'badgeQ4', q4, 'Eliminate');
}

window.reclassifyTaskPriority = function(taskId, newPriority) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.priority = newPriority;
    saveTasksToStorage();
  }
};

// ============================================================================
// Render: Conversation History Stream
// ============================================================================
function renderConversationStream() {
  const stream = document.getElementById('conversationStream');
  if (!stream) return;

  stream.innerHTML = state.conversationHistory.map(msg => {
    const isUser = msg.sender === 'user';
    const timeLabel = msg.time || 'TODAY';
    return `
      <div class="chat-turn ${isUser ? 'user' : 'assistant'}">
        <div class="turn-meta">${isUser ? 'You' : 'LifePilot'} · ${timeLabel}</div>
        <div class="turn-bubble">
          ${formatMarkdown(msg.text)}
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
// Navigation: Switching Views
// ============================================================================
window.switchMainView = function(viewId) {
  state.activeView = viewId;

  // Header tabs active state
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });

  // Workspace views active state
  document.querySelectorAll('.workspace-view').forEach(view => {
    view.classList.toggle('active', view.id === viewId);
  });

  // If switching on mobile
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
  }
};

window.confirmDeleteTask = function(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    saveTasksToStorage();
  }
};

function openAddTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'Add Task';
  document.getElementById('taskEditId').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskPriority').value = 'Medium';
  document.getElementById('taskCategory').value = 'Study';
  document.getElementById('taskDueDate').value = todayStr;
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

// Plan to Task Conversions
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
  alert(`Added "${item.activity}" to your task board.`);
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
  alert(`Added ${count} plan activities into your active tasks.`);
}

// ============================================================================
// Assistant Interaction: Chat & API Dispatch
// ============================================================================
async function handleChatSubmit(userMessage) {
  if (!userMessage || !userMessage.trim()) return;

  const inputEl = document.getElementById('composerInput');
  const sendBtn = document.getElementById('sendBtn');
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

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        tasks: state.tasks,
        history: state.conversationHistory
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Server error occurred');

    const result = data.data;

    // Append assistant response
    state.conversationHistory.push({
      sender: 'assistant',
      text: result.reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveHistoryToStorage();

    // Handle structured actions
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

    // Voice Narration
    if (state.ttsEnabled) {
      speakAssistantReply(result.reply);
    }

    // Update AI Status badge
    updateAiStatusBadge(result.serviceStatus, result.serviceLabel);

  } catch (err) {
    console.error('Chat submit error:', err);
    state.conversationHistory.push({
      sender: 'assistant',
      text: `An error occurred while processing your request: ${err.message}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveHistoryToStorage();
    updateAiStatusBadge('offline', 'AI Offline · Retry');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
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
      micBtn.style.opacity = '0.4';
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
        console.error('Recognition start error:', e);
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

  const clean = text.replace(/[*_#`]/g, '').trim();
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
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

    document.getElementById('diagCurrentStatus').textContent = data.aiStatusLabel || 'Demo Mode';
    document.getElementById('diagAwsRegion').textContent = data.awsBedrock?.region || 'us-east-1';
    document.getElementById('diagAwsModel').textContent = data.awsBedrock?.modelId || 'anthropic.claude-3-5-sonnet';
    document.getElementById('diagServerUptime').textContent = `${data.uptime || 0} seconds`;
  } catch (err) {
    updateAiStatusBadge('offline', 'AI Offline · Retry');
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
  const btn = document.getElementById('testBedrockBtn');
  const box = document.getElementById('testFeedbackBox');

  btn.disabled = true;
  box.className = 'test-feedback-box';
  box.textContent = 'Testing connection with Amazon Bedrock...';
  box.classList.remove('hidden');

  try {
    const res = await fetch('/api/test-bedrock', { method: 'POST' });
    const json = await res.json();
    const data = json.data;

    if (data.connected) {
      box.className = 'test-feedback-box success';
      box.innerHTML = `
        <strong>Bedrock Connected</strong><br>
        Region: ${data.region} · Latency: ${data.latencyMs}ms<br>
        Response: "<em>${escapeHtml(data.reply.trim())}</em>"
      `;
      updateAiStatusBadge('connected', 'Amazon Bedrock Connected');
    } else {
      box.className = 'test-feedback-box error';
      box.innerHTML = `
        <strong>${escapeHtml(data.statusLabel || 'Connection Test Failed')}</strong><br>
        ${escapeHtml(data.error || data.message || 'Check IAM keys and Bedrock Model Access.')}
      `;
      updateAiStatusBadge('offline', 'AI Offline · Retry');
    }
  } catch (e) {
    box.className = 'test-feedback-box error';
    box.textContent = `Request error: ${e.message}`;
    updateAiStatusBadge('offline', 'AI Offline · Retry');
  } finally {
    btn.disabled = false;
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
    handleChatSubmit(composerInput.value);
  });

  // Enter to submit, Shift+Enter for newline
  composerInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(composerInput.value);
    }
  });

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

  // Tasks actions
  document.getElementById('openAddTaskBtn')?.addEventListener('click', openAddTaskModal);

  document.getElementById('clearCompletedTasksBtn')?.addEventListener('click', () => {
    state.tasks = state.tasks.filter(t => !t.completed);
    saveTasksToStorage();
  });

  document.getElementById('loadSampleTasksBtn')?.addEventListener('click', () => {
    state.tasks = [...INITIAL_SAMPLE_TASKS];
    saveTasksToStorage();
  });

  // Task Form Submit
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
      // Editing existing task
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
      // Adding new task
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
  });

  document.getElementById('closeTaskModalBtn')?.addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskModalBtn')?.addEventListener('click', closeTaskModal);

  // Plans View actions
  document.getElementById('createCustomPlanBtn')?.addEventListener('click', () => {
    document.getElementById('planModal').classList.remove('hidden');
  });

  document.getElementById('convertAllPlanTasksBtn')?.addEventListener('click', convertAllPlanItemsToTasks);

  // Plan Modal Submit
  const planForm = document.getElementById('planForm');
  planForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const goal = document.getElementById('planGoal').value.trim();
    const days = parseInt(document.getElementById('planDays').value, 10) || 5;
    const hours = parseInt(document.getElementById('planDailyHours').value, 10) || 3;

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

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const aiStatusPill = document.getElementById('aiStatusPill');

  const openSettings = () => {
    checkSystemStatus();
    settingsModal.classList.remove('hidden');
  };
  const closeSettings = () => {
    settingsModal.classList.add('hidden');
  };

  settingsBtn?.addEventListener('click', openSettings);
  aiStatusPill?.addEventListener('click', openSettings);
  document.getElementById('closeSettingsModalBtn')?.addEventListener('click', closeSettings);
  document.getElementById('closeSettingsBottomBtn')?.addEventListener('click', closeSettings);
  document.getElementById('testBedrockBtn')?.addEventListener('click', testBedrockHandshake);
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
