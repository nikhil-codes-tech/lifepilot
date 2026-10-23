/**
 * LifePilot AI — Client Application
 * Simulated Alexa+ Assistant Experience & AWS Bedrock Productivity Hub
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  tasks: [],
  currentPlan: null,
  activePlanDay: 1,
  conversationHistory: [],
  ttsEnabled: true,
  isListening: false,
  isThinking: false,
  filter: 'all',
  searchQuery: '',
  systemStatus: null
};

// ============================================================================
// Web Audio API — Alexa+ Chime Synthesizer
// ============================================================================
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  // Alexa signature wake chime (gentle two-tone rising frequency: D5 -> A5)
  playWakeChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      // Audio autoplay may be prevented before user interaction
    }
  }

  // Soft accomplishment chime when a task is completed or plan generated
  playSuccessChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18); // G5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Ignore
    }
  }
}

const sfx = new SoundEffects();

// ============================================================================
// Speech Recognition (Voice Input) & Speech Synthesis (TTS)
// ============================================================================
let speechRecognition = null;

function setupSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceBtn = document.getElementById('voiceBtn');
  const speechBanner = document.getElementById('speechBanner');
  const speechText = document.getElementById('speechText');

  if (!SpeechRec) {
    if (voiceBtn) {
      voiceBtn.title = 'Speech recognition is not supported in this browser';
      voiceBtn.style.opacity = '0.5';
    }
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onstart = () => {
    state.isListening = true;
    sfx.playWakeChime();
    setAlexaRingState('listening', 'Alexa+ is listening...');
    voiceBtn.classList.add('recording');
    speechBanner.classList.remove('hidden');
    speechText.textContent = 'Listening to your voice... Speak now';
  };

  speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('chatInput').value = transcript;
    speechText.textContent = `"${transcript}"`;
  };

  speechRecognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopListening();
    setAlexaRingState('idle', 'Tap mic or type a request');
  };

  speechRecognition.onend = () => {
    const chatInput = document.getElementById('chatInput');
    stopListening();

    if (chatInput.value.trim()) {
      handleChatSubmit(chatInput.value.trim());
      chatInput.value = '';
    } else {
      setAlexaRingState('idle', 'Alexa+ is ready. How can I help you?');
    }
  };

  voiceBtn.addEventListener('click', () => {
    sfx.init();
    if (state.isListening) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (err) {
        console.error('Recognition start error:', err);
      }
    }
  });

  document.getElementById('cancelSpeechBtn')?.addEventListener('click', () => {
    stopListening();
  });
}

function stopListening() {
  state.isListening = false;
  const voiceBtn = document.getElementById('voiceBtn');
  const speechBanner = document.getElementById('speechBanner');
  if (voiceBtn) voiceBtn.classList.remove('recording');
  if (speechBanner) speechBanner.classList.add('hidden');
}

function speakText(text) {
  if (!state.ttsEnabled || !window.speechSynthesis) return;

  window.speechSynthesis.cancel(); // Cancel any ongoing speech

  // Strip markdown formatting for cleaner speech narration
  const cleanSpeech = text
    .replace(/[#*_`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (!cleanSpeech) return;

  const utterance = new SpeechSynthesisUtterance(cleanSpeech);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  // Prefer a smooth English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.onstart = () => {
    setAlexaRingState('speaking', 'Alexa+ is speaking...');
  };

  utterance.onend = () => {
    setAlexaRingState('idle', 'Alexa+ is ready');
  };

  utterance.onerror = () => {
    setAlexaRingState('idle', 'Alexa+ is ready');
  };

  window.speechSynthesis.speak(utterance);
}

// ============================================================================
// Alexa Ring Visual States
// ============================================================================
function setAlexaRingState(ringState, captionText) {
  const ring = document.getElementById('alexaRing');
  const caption = document.getElementById('alexaStatusCaption');

  if (ring) {
    ring.className = 'alexa-ring';
    if (ringState !== 'idle') {
      ring.classList.add(ringState);
    }
  }

  if (caption && captionText) {
    caption.textContent = captionText;
  }
}

// ============================================================================
// Sample Starter Data
// ============================================================================
const SAMPLE_TASKS = [
  {
    id: 'sample_1',
    title: 'Review Java Object-Oriented Principles (OOP)',
    priority: 'High',
    category: 'Study',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    timeEstimate: '2h',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample_2',
    title: 'Deploy LifePilot AI web app to AWS hosting',
    priority: 'High',
    category: 'Coding',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    timeEstimate: '1.5h',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample_3',
    title: 'Prepare slides and architecture demo video',
    priority: 'Medium',
    category: 'Work',
    dueDate: new Date(Date.now() + 259200000).toISOString().split('T')[0],
    timeEstimate: '45m',
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample_4',
    title: 'Afternoon hydration and 20-minute walk',
    priority: 'Low',
    category: 'Health',
    dueDate: new Date().toISOString().split('T')[0],
    timeEstimate: '20m',
    completed: true,
    createdAt: new Date().toISOString()
  }
];

// ============================================================================
// Storage & Persistence
// ============================================================================
function loadStoredData() {
  try {
    const savedTasks = localStorage.getItem('lifepilot_tasks');
    if (savedTasks) {
      state.tasks = JSON.parse(savedTasks);
    } else {
      state.tasks = [...SAMPLE_TASKS];
      saveTasksToStorage();
    }

    const savedPlan = localStorage.getItem('lifepilot_plan');
    if (savedPlan) {
      state.currentPlan = JSON.parse(savedPlan);
    }

    const savedHistory = localStorage.getItem('lifepilot_chat_history');
    if (savedHistory) {
      state.conversationHistory = JSON.parse(savedHistory);
    } else {
      // Initial welcome message
      state.conversationHistory = [
        {
          sender: 'assistant',
          text: `Welcome to **LifePilot AI**! I'm your personal productivity copilot.

I can help you build structured study schedules, organize your workday, prioritize tasks, and keep you on track.

Try asking:
- *"I have five days to prepare for my Java exam. Help me create a revision plan."*
- *"Help me plan my day."*
- *"What should I prioritize today?"*`,
          timestamp: new Date().toISOString(),
          isSimulated: false,
          service: 'LifePilot Assistant'
        }
      ];
      saveHistoryToStorage();
    }
  } catch (err) {
    console.error('Failed to parse localStorage data:', err);
    state.tasks = [...SAMPLE_TASKS];
  }
}

function saveTasksToStorage() {
  localStorage.setItem('lifepilot_tasks', JSON.stringify(state.tasks));
  renderTasks();
  updateStats();
  renderEisenhowerMatrix();
}

function savePlanToStorage() {
  if (state.currentPlan) {
    localStorage.setItem('lifepilot_plan', JSON.stringify(state.currentPlan));
  } else {
    localStorage.removeItem('lifepilot_plan');
  }
  renderPlan();
}

function saveHistoryToStorage() {
  localStorage.setItem('lifepilot_chat_history', JSON.stringify(state.conversationHistory));
  renderChatHistory();
}

// ============================================================================
// UI Rendering: Tasks & Stats
// ============================================================================
function renderTasks() {
  const container = document.getElementById('taskListContainer');
  const counterText = document.getElementById('tasksCounterText');
  const taskBoardBadge = document.getElementById('taskBoardBadge');
  const mobilePendingBadge = document.getElementById('mobilePendingBadge');

  if (!container) return;

  // Filter tasks
  let filtered = [...state.tasks];

  if (state.filter === 'pending') {
    filtered = filtered.filter(t => !t.completed);
  } else if (state.filter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  } else if (state.filter === 'high') {
    filtered = filtered.filter(t => t.priority === 'High');
  } else if (state.filter === 'medium') {
    filtered = filtered.filter(t => t.priority === 'Medium');
  } else if (state.filter === 'low') {
    filtered = filtered.filter(t => t.priority === 'Low');
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }

  const pendingCount = state.tasks.filter(t => !t.completed).length;
  if (taskBoardBadge) taskBoardBadge.textContent = pendingCount;
  if (mobilePendingBadge) mobilePendingBadge.textContent = pendingCount;
  if (counterText) counterText.textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'} displayed (${pendingCount} pending)`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px;">
        <div class="empty-icon">📝</div>
        <h4>No tasks found</h4>
        <p>There are no tasks matching your current filter. Add one or ask Alexa+ to plan your day!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(task => `
    <div class="task-card ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <div class="task-card-left">
        <input 
          type="checkbox" 
          class="task-checkbox" 
          ${task.completed ? 'checked' : ''} 
          onchange="toggleTaskCompletion('${task.id}')"
          title="Mark complete"
        />
        <div class="task-card-details">
          <div class="task-card-title">${escapeHtml(task.title)}</div>
          <div class="task-card-meta">
            <span class="priority-pill ${task.priority}">${task.priority}</span>
            <span class="category-tag">${task.category}</span>
            <span>⏱️ ${task.timeEstimate || '30m'}</span>
            ${task.dueDate ? `<span>📅 ${task.dueDate}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="task-card-actions">
        <button class="btn-task-delete" onclick="deleteTask('${task.id}')" title="Delete task">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const pendingCount = state.tasks.filter(t => !t.completed).length;
  const completedCount = state.tasks.filter(t => t.completed).length;
  const total = state.tasks.length;
  const rate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const pendingEl = document.getElementById('pendingCount');
  const completedEl = document.getElementById('completedCount');
  const rateEl = document.getElementById('completionRate');

  if (pendingEl) pendingEl.textContent = pendingCount;
  if (completedEl) completedEl.textContent = completedCount;
  if (rateEl) rateEl.textContent = `${rate}%`;
}

// ============================================================================
// UI Rendering: Daily & Study Plan
// ============================================================================
function renderPlan() {
  const titleEl = document.getElementById('currentPlanTitle');
  const summaryEl = document.getElementById('currentPlanSummary');
  const dayTabsBar = document.getElementById('dayTabsBar');
  const timelineEl = document.getElementById('planTimeline');
  const addAllBtn = document.getElementById('addAllPlanTasksBtn');

  if (!state.currentPlan || !state.currentPlan.days || state.currentPlan.days.length === 0) {
    if (titleEl) titleEl.textContent = 'Active Schedule';
    if (summaryEl) summaryEl.textContent = 'Ask the assistant to generate a study roadmap or daily itinerary.';
    if (dayTabsBar) dayTabsBar.style.display = 'none';
    if (addAllBtn) addAllBtn.style.display = 'none';
    if (timelineEl) {
      timelineEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗓️</div>
          <h3>No Active Plan Loaded</h3>
          <p>LifePilot AI can generate optimized daily itineraries or comprehensive multi-day exam study schedules.</p>
          <div class="empty-actions">
            <button class="btn btn-accent" id="emptyJavaBtn">Try: 5-Day Java Exam Plan</button>
            <button class="btn btn-secondary" id="emptyDayBtn">Try: Plan My Day</button>
          </div>
        </div>
      `;
      setupEmptyStateButtons();
    }
    return;
  }

  const plan = state.currentPlan;
  if (titleEl) titleEl.textContent = plan.title || 'Productivity Plan';
  if (summaryEl) summaryEl.textContent = plan.summary || 'Optimized milestones tailored for peak focus.';
  if (addAllBtn) addAllBtn.style.display = 'inline-flex';

  // Multi-day tabs
  if (plan.days.length > 1) {
    dayTabsBar.style.display = 'flex';
    dayTabsBar.innerHTML = plan.days.map((d, index) => {
      const dayNum = d.day || (index + 1);
      return `
        <button 
          class="day-tab-btn ${state.activePlanDay === dayNum ? 'active' : ''}" 
          onclick="switchPlanDay(${dayNum})"
        >
          Day ${dayNum}
        </button>
      `;
    }).join('');
  } else {
    dayTabsBar.style.display = 'none';
  }

  // Find active day
  const activeDayObj = plan.days.find(d => (d.day || 1) === state.activePlanDay) || plan.days[0];

  if (!activeDayObj || !activeDayObj.items || activeDayObj.items.length === 0) {
    timelineEl.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No schedule items found for Day ${state.activePlanDay}.</p>`;
    return;
  }

  timelineEl.innerHTML = `
    ${activeDayObj.theme ? `<div style="font-weight: 700; color: var(--alexa-cyan); font-size: 0.9rem; margin-bottom: 8px;">Day ${activeDayObj.day || 1}: ${escapeHtml(activeDayObj.theme)}</div>` : ''}
    ${activeDayObj.items.map((item, idx) => `
      <div class="timeline-item-card">
        <div class="timeline-item-left">
          <span class="timeline-time-badge">${escapeHtml(item.time || 'Flexible')}</span>
          <div class="timeline-content">
            <h4>${escapeHtml(item.activity)}</h4>
            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
            <div class="timeline-tags">
              <span class="badge-tag" style="background: rgba(112, 161, 255, 0.15); color: var(--category-study);">${escapeHtml(item.category || 'Study')}</span>
              ${item.duration ? `<span class="badge-tag" style="background: rgba(255, 255, 255, 0.08); color: var(--text-secondary);">⏳ ${escapeHtml(item.duration)}</span>` : ''}
            </div>
          </div>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="addPlanItemToTasks(${state.activePlanDay}, ${idx})" title="Add this item to your task board">
            ➕ Add to Tasks
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

function switchPlanDay(dayNum) {
  state.activePlanDay = dayNum;
  renderPlan();
}

// ============================================================================
// UI Rendering: Eisenhower Priority Matrix
// ============================================================================
function renderEisenhowerMatrix() {
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

    if (isHigh && isUrgent) {
      q1.push(task);
    } else if (isHigh || (!isUrgent && task.priority === 'Medium')) {
      q2.push(task);
    } else if (isUrgent) {
      q3.push(task);
    } else {
      q4.push(task);
    }
  });

  const renderQuadrant = (listElId, countElId, items) => {
    const listEl = document.getElementById(listElId);
    const countEl = document.getElementById(countElId);
    if (countEl) countEl.textContent = items.length;
    if (listEl) {
      if (items.length === 0) {
        listEl.innerHTML = `<li style="color: var(--text-muted); font-size: 0.76rem; padding: 6px 0;">No tasks in this quadrant</li>`;
      } else {
        listEl.innerHTML = items.map(t => `
          <li class="matrix-list-item">
            <span>${escapeHtml(t.title)}</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">${t.category}</span>
          </li>
        `).join('');
      }
    }
  };

  renderQuadrant('q1List', 'q1Count', q1);
  renderQuadrant('q2List', 'q2Count', q2);
  renderQuadrant('q3List', 'q3Count', q3);
  renderQuadrant('q4List', 'q4Count', q4);
}

// ============================================================================
// UI Rendering: Chat History
// ============================================================================
function renderChatHistory() {
  const container = document.getElementById('chatHistory');
  if (!container) return;

  container.innerHTML = state.conversationHistory.map(msg => {
    const isUser = msg.sender === 'user';
    return `
      <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">
        <div class="chat-bubble-header">
          <span class="chat-sender-badge">
            ${isUser ? '👤 You' : '✦ Alexa+ Assistant'}
          </span>
          ${!isUser && msg.service ? `<span class="chat-engine-tag">${escapeHtml(msg.service)}</span>` : ''}
        </div>
        <div class="chat-bubble-content">
          ${formatMarkdown(msg.text)}
        </div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Markdown formatter for conversational assistant responses
function formatMarkdown(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);

  // Bold **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Bullet lists (- or *)
  formatted = formatted.replace(/(?:^|\n)[-*]\s+(.+)/g, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  // Line breaks
  formatted = formatted.replace(/\n\n/g, '<br><br>');
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Assistant Interaction & API Dispatch
// ============================================================================
async function handleChatSubmit(userMessage) {
  if (!userMessage || !userMessage.trim()) return;

  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  // Append user message
  state.conversationHistory.push({
    sender: 'user',
    text: userMessage.trim(),
    timestamp: new Date().toISOString()
  });
  saveHistoryToStorage();

  // Clear input & disable send
  if (chatInput) chatInput.value = '';
  if (sendBtn) sendBtn.disabled = true;

  // Visual thinking state
  setAlexaRingState('thinking', 'Alexa+ is thinking & generating plan...');

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

    if (!data.success) {
      throw new Error(data.error || 'Server returned failure response');
    }

    const result = data.data;

    // Append assistant response
    state.conversationHistory.push({
      sender: 'assistant',
      text: result.reply,
      timestamp: new Date().toISOString(),
      isSimulated: result.isSimulated,
      service: result.service || 'LifePilot Engine'
    });
    saveHistoryToStorage();

    // Check for structured actions
    if (result.structuredData) {
      // 1. If tasks returned, integrate them
      if (result.structuredData.tasks && result.structuredData.tasks.length > 0) {
        result.structuredData.tasks.forEach(raw => {
          state.tasks.unshift({
            id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: raw.title,
            priority: raw.priority || 'Medium',
            category: raw.category || 'Study',
            dueDate: raw.dueDate || null,
            timeEstimate: raw.timeEstimate || '45m',
            completed: false,
            createdAt: new Date().toISOString()
          });
        });
        saveTasksToStorage();
        sfx.playSuccessChime();
      }

      // 2. If plan returned, update plan viewer
      if (result.structuredData.plan) {
        state.currentPlan = result.structuredData.plan;
        state.activePlanDay = 1;
        savePlanToStorage();
        sfx.playSuccessChime();

        // Switch active tab on right panel to Plan View
        switchHubTab('planTab');
      }
    }

    // Speak response if voice enabled
    speakText(result.reply);

  } catch (err) {
    console.error('Chat error:', err);
    state.conversationHistory.push({
      sender: 'assistant',
      text: `⚠️ **Error:** Unable to complete request. ${err.message}`,
      timestamp: new Date().toISOString(),
      isSimulated: true,
      service: 'System'
    });
    saveHistoryToStorage();
    setAlexaRingState('idle', 'An error occurred. Please try again.');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (!state.isListening && !window.speechSynthesis?.speaking) {
      setAlexaRingState('idle', 'Alexa+ is ready');
    }
  }
}

// ============================================================================
// Task Actions
// ============================================================================
window.toggleTaskCompletion = function(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    if (task.completed) sfx.playSuccessChime();
    saveTasksToStorage();
  }
};

window.deleteTask = function(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveTasksToStorage();
};

window.addPlanItemToTasks = function(dayNum, itemIndex) {
  if (!state.currentPlan || !state.currentPlan.days) return;
  const dayObj = state.currentPlan.days.find(d => (d.day || 1) === dayNum);
  if (!dayObj || !dayObj.items || !dayObj.items[itemIndex]) return;

  const item = dayObj.items[itemIndex];
  state.tasks.unshift({
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: `Day ${dayNum}: ${item.activity}`,
    priority: 'High',
    category: item.category || 'Study',
    timeEstimate: item.duration || '60m',
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveTasksToStorage();
  sfx.playSuccessChime();
  alert(`Added "${item.activity}" to your task board!`);
};

function addAllPlanTasks() {
  if (!state.currentPlan || !state.currentPlan.days) return;
  let addedCount = 0;

  state.currentPlan.days.forEach(dayObj => {
    const dayNum = dayObj.day || 1;
    if (dayObj.items && Array.isArray(dayObj.items)) {
      dayObj.items.forEach(item => {
        state.tasks.unshift({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: `Day ${dayNum}: ${item.activity}`,
          priority: 'High',
          category: item.category || 'Study',
          timeEstimate: item.duration || '60m',
          dueDate: new Date().toISOString().split('T')[0],
          completed: false,
          createdAt: new Date().toISOString()
        });
        addedCount++;
      });
    }
  });

  saveTasksToStorage();
  sfx.playSuccessChime();
  switchHubTab('tasksTab');
  alert(`Successfully transferred ${addedCount} plan milestones to your Task Board!`);
}

// ============================================================================
// System Status & Diagnostics Check
// ============================================================================
async function checkSystemStatus() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const diagMode = document.getElementById('diagEngineMode');
  const diagRegion = document.getElementById('diagRegion');
  const diagModel = document.getElementById('diagModel');
  const diagUptime = document.getElementById('diagUptime');

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.systemStatus = data;

    if (data.awsBedrock && data.awsBedrock.configured) {
      if (statusDot) {
        statusDot.className = 'status-dot status-live';
      }
      if (statusText) statusText.textContent = 'Amazon Bedrock (Live)';
      if (diagMode) diagMode.textContent = '🟢 Amazon Bedrock (AWS Builder Live)';
    } else {
      if (statusDot) {
        statusDot.className = 'status-dot status-demo';
      }
      if (statusText) statusText.textContent = 'Demo Mode (Local AI)';
      if (diagMode) diagMode.textContent = '🟡 Local Simulation Engine (Demo Mode)';
    }

    if (diagRegion) diagRegion.textContent = data.awsBedrock.region || 'us-east-1';
    if (diagModel) diagModel.textContent = data.awsBedrock.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    if (diagUptime) diagUptime.textContent = `${data.uptime} seconds`;

  } catch (err) {
    if (statusDot) statusDot.className = 'status-dot status-demo';
    if (statusText) statusText.textContent = 'Offline';
  }
}

async function runBedrockDiagnostics() {
  const resultBox = document.getElementById('bedrockTestResult');
  const testBtn = document.getElementById('testBedrockBtn');

  resultBox.className = 'test-result-box';
  resultBox.textContent = 'Testing connection to Amazon Bedrock...';
  resultBox.classList.remove('hidden');
  testBtn.disabled = true;

  try {
    const res = await fetch('/api/test-bedrock', { method: 'POST' });
    const json = await res.json();
    const data = json.data;

    if (data.connected) {
      resultBox.className = 'test-result-box success';
      resultBox.innerHTML = `
        <strong>🎉 Bedrock Handshake Successful!</strong><br>
        Region: ${data.region}<br>
        Model: ${data.modelId}<br>
        Roundtrip Latency: ${data.latencyMs} ms<br>
        Model Response: "<em>${escapeHtml(data.reply.trim())}</em>"
      `;
    } else {
      resultBox.className = 'test-result-box error';
      resultBox.innerHTML = `
        <strong>❌ Connection Test Result:</strong><br>
        ${escapeHtml(data.error || data.message || 'Check AWS IAM permissions & Model Access.')}<br>
        <span style="font-size: 0.75rem;">Tip: Ensure Model Access is enabled for ${data.modelId} in AWS Bedrock Console.</span>
      `;
    }
  } catch (e) {
    resultBox.className = 'test-result-box error';
    resultBox.textContent = `Request failed: ${e.message}`;
  } finally {
    testBtn.disabled = false;
  }
}

// ============================================================================
// UI Event Handlers & Tabs
// ============================================================================
function switchHubTab(targetId) {
  document.querySelectorAll('.hub-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.target === targetId);
  });
  document.querySelectorAll('.hub-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === targetId);
  });
}

function setupEmptyStateButtons() {
  document.getElementById('emptyJavaBtn')?.addEventListener('click', () => {
    handleChatSubmit('I have five days to prepare for my Java exam. Help me create a revision plan.');
  });
  document.getElementById('emptyDayBtn')?.addEventListener('click', () => {
    handleChatSubmit('Help me plan my day.');
  });
}

function initializeEventListeners() {
  // Chat form submit
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sfx.init();
    handleChatSubmit(chatInput.value);
  });

  // Prompt chips
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sfx.init();
      const prompt = chip.dataset.prompt;
      handleChatSubmit(prompt);
    });
  });

  // Hub tabs (Right Panel)
  document.querySelectorAll('.hub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchHubTab(tab.dataset.target);
    });
  });

  // Mobile navigation tabs
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.tab;
      const assistantPanel = document.getElementById('assistantPanel');
      const productivityPanel = document.getElementById('productivityPanel');

      if (target === 'assistantPanel') {
        assistantPanel.classList.add('active');
        productivityPanel.classList.remove('active');
      } else if (target === 'planPanel') {
        assistantPanel.classList.remove('active');
        productivityPanel.classList.add('active');
        switchHubTab('planTab');
      } else if (target === 'taskPanel') {
        assistantPanel.classList.remove('active');
        productivityPanel.classList.add('active');
        switchHubTab('tasksTab');
      }
    });
  });

  // Add all plan items button
  document.getElementById('addAllPlanTasksBtn')?.addEventListener('click', addAllPlanTasks);

  // Quick plan button
  document.getElementById('generateQuickPlanBtn')?.addEventListener('click', () => {
    handleChatSubmit('Help me plan an efficient 8-hour productive workday today.');
  });

  // Prioritize button in matrix tab
  document.getElementById('runAiPrioritizationBtn')?.addEventListener('click', () => {
    handleChatSubmit('What should I prioritize today based on my active tasks?');
  });

  // Task filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filter = pill.dataset.filter;
      renderTasks();
    });
  });

  // Task search input
  document.getElementById('taskSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTasks();
  });

  // Clear completed tasks
  document.getElementById('clearCompletedBtn')?.addEventListener('click', () => {
    state.tasks = state.tasks.filter(t => !t.completed);
    saveTasksToStorage();
  });

  // Reset sample tasks
  document.getElementById('resetSampleTasksBtn')?.addEventListener('click', () => {
    state.tasks = [...SAMPLE_TASKS];
    saveTasksToStorage();
  });

  // Add Task Modal
  const addTaskModal = document.getElementById('addTaskModal');
  const openAddTaskModalBtn = document.getElementById('openAddTaskModalBtn');
  const closeAddTaskModalBtn = document.getElementById('closeAddTaskModalBtn');
  const cancelAddTaskBtn = document.getElementById('cancelAddTaskBtn');
  const addTaskForm = document.getElementById('addTaskForm');

  openAddTaskModalBtn?.addEventListener('click', () => {
    document.getElementById('taskDueDateInput').value = new Date().toISOString().split('T')[0];
    addTaskModal.classList.remove('hidden');
    document.getElementById('taskTitleInput').focus();
  });

  const closeTaskModal = () => addTaskModal.classList.add('hidden');
  closeAddTaskModalBtn?.addEventListener('click', closeTaskModal);
  cancelAddTaskBtn?.addEventListener('click', closeTaskModal);

  addTaskForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('taskTitleInput').value.trim();
    const priority = document.getElementById('taskPrioritySelect').value;
    const category = document.getElementById('taskCategorySelect').value;
    const dueDate = document.getElementById('taskDueDateInput').value;
    const timeEstimate = document.getElementById('taskEstimateInput').value.trim();

    if (!title) return;

    state.tasks.unshift({
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      priority,
      category,
      dueDate: dueDate || null,
      timeEstimate: timeEstimate || '30m',
      completed: false,
      createdAt: new Date().toISOString()
    });

    saveTasksToStorage();
    closeTaskModal();
    addTaskForm.reset();
    sfx.playSuccessChime();
  });

  // Settings / Diagnostics Modal
  const settingsModal = document.getElementById('settingsModal');
  const settingsBtn = document.getElementById('settingsBtn');
  const bedrockStatusBtn = document.getElementById('bedrockStatusBtn');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const closeSettingsFooterBtn = document.getElementById('closeSettingsFooterBtn');

  const openSettings = () => {
    checkSystemStatus();
    settingsModal.classList.remove('hidden');
  };
  const closeSettings = () => settingsModal.classList.add('hidden');

  settingsBtn?.addEventListener('click', openSettings);
  bedrockStatusBtn?.addEventListener('click', openSettings);
  closeSettingsModalBtn?.addEventListener('click', closeSettings);
  closeSettingsFooterBtn?.addEventListener('click', closeSettings);

  document.getElementById('testBedrockBtn')?.addEventListener('click', runBedrockDiagnostics);

  // TTS Toggle Button
  const ttsToggleBtn = document.getElementById('ttsToggleBtn');
  ttsToggleBtn?.addEventListener('click', () => {
    state.ttsEnabled = !state.ttsEnabled;
    ttsToggleBtn.classList.toggle('active', state.ttsEnabled);
    if (!state.ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn?.addEventListener('click', () => {
    document.body.classList.toggle('theme-alexa-light');
  });

  setupEmptyStateButtons();
}

// ============================================================================
// Initialization
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  renderTasks();
  updateStats();
  renderPlan();
  renderEisenhowerMatrix();
  renderChatHistory();
  initializeEventListeners();
  setupSpeechRecognition();
  checkSystemStatus();

  // Highlight TTS enabled by default
  document.getElementById('ttsToggleBtn')?.classList.add('active');
});
