/**
 * LifePilot AI — Task Management & Scheduling Utilities
 * Single source of truth for task processing, duration calculation,
 * schedule conflict detection, and Eisenhower classification.
 */

const TASK_CATEGORIES = ['Study', 'Work', 'Personal', 'Coding', 'Health', 'General'];

const PRIORITIES = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/**
 * Standard initial task list used across client, server, and test suites.
 */
function getInitialTasks() {
  const today = new Date();
  const dTomorrow = new Date(Date.now() + 86400000);
  const dInTwoDays = new Date(Date.now() + 86400000 * 2);
  const dInThreeDays = new Date(Date.now() + 86400000 * 3);

  const fmt = (d) => d.toISOString().split('T')[0];

  return [
    {
      id: 'task_1',
      title: 'Review Java Object-Oriented Principles',
      description: 'Polymorphism, inheritance, and interface contracts practice',
      priority: 'High',
      category: 'Study',
      dueDate: fmt(dTomorrow),
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
      dueDate: fmt(dInTwoDays),
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
      dueDate: fmt(dInThreeDays),
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
      dueDate: fmt(today),
      timeEstimate: '20m',
      estimatedMinutes: 20,
      completed: true,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Parses time estimate strings (e.g. '2h', '1.5h', '45m', '90m') into integer minutes.
 */
function parseEstimateToMinutes(estimate = '') {
  if (!estimate) return 30;
  const str = String(estimate).trim().toLowerCase();
  const hoursMatch = str.match(/([\d.]+)\s*h/);
  if (hoursMatch) {
    return Math.round(parseFloat(hoursMatch[1]) * 60);
  }
  const minsMatch = str.match(/(\d+)\s*m/);
  if (minsMatch) {
    return parseInt(minsMatch[1], 10);
  }
  const num = parseFloat(str);
  return isNaN(num) ? 30 : Math.round(num);
}

/**
 * Formats integer minutes into clean "Xh Ym remaining" format.
 * Example: 255 -> "4h 15m remaining"
 */
function formatDurationRemaining(minutes) {
  if (!minutes || minutes <= 0) return '0m remaining';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m remaining`;
  if (h > 0) return `${h}h remaining`;
  return `${m}m remaining`;
}

/**
 * Validates and normalizes task objects.
 */
function validateTask(raw = {}) {
  if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
    throw new Error('Task title is required');
  }

  const priority = Object.values(PRIORITIES).includes(raw.priority)
    ? raw.priority
    : PRIORITIES.MEDIUM;

  const category = TASK_CATEGORIES.includes(raw.category)
    ? raw.category
    : 'General';

  const minutes = parseEstimateToMinutes(raw.timeEstimate || '30m');

  return {
    id: raw.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: raw.title.trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    priority,
    category,
    dueDate: raw.dueDate || null,
    timeEstimate: raw.timeEstimate || '30m',
    estimatedMinutes: minutes,
    completed: Boolean(raw.completed),
    createdAt: raw.createdAt || new Date().toISOString(),
    completedAt: raw.completed ? (raw.completedAt || new Date().toISOString()) : null
  };
}

/**
 * Generates an informative daily summary sentence from current task data.
 * Example: "You have 3 pending tasks, including 2 high-priority items."
 */
function generateDailySummary(tasks = []) {
  const pending = tasks.filter(t => !t.completed);
  if (pending.length === 0) {
    return tasks.length > 0
      ? 'Everything is complete. Nice work.'
      : 'Your task list is clear. Add a task or create a plan to get started.';
  }

  const highCount = pending.filter(t => t.priority === PRIORITIES.HIGH).length;

  if (highCount > 0) {
    return `You have ${pending.length} pending task${pending.length === 1 ? '' : 's'}, including ${highCount} high-priority item${highCount === 1 ? '' : 's'}.`;
  }
  return `You have ${pending.length} pending task${pending.length === 1 ? '' : 's'} scheduled for today.`;
}

/**
 * Computes workload metrics from actual task data.
 */
function computeWorkloadMetrics(tasks = []) {
  const total = tasks.length;
  const completedTasks = tasks.filter(t => t.completed);
  const pendingTasks = tasks.filter(t => !t.completed);

  const pendingMinutes = pendingTasks.reduce(
    (sum, t) => sum + (t.estimatedMinutes || parseEstimateToMinutes(t.timeEstimate)),
    0
  );

  return {
    totalTasks: total,
    completedCount: completedTasks.length,
    pendingCount: pendingTasks.length,
    completionPercentage: total > 0 ? Math.round((completedTasks.length / total) * 100) : 0,
    totalFocusMinutes: pendingMinutes,
    focusTimeString: formatDurationRemaining(pendingMinutes),
    summarySentence: generateDailySummary(tasks)
  };
}

/**
 * Smart Schedule Conflict Detection (Differentiator Feature)
 * Checks whether requested tasks fit into available time.
 */
function checkScheduleConflict(totalTaskMinutes, availableHours) {
  const availableMinutes = Math.round((availableHours || 3) * 60);
  const diffMinutes = totalTaskMinutes - availableMinutes;

  if (diffMinutes > 0) {
    const diffH = Math.floor(diffMinutes / 60);
    const diffM = diffMinutes % 60;
    const diffStr = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`;
    const totalStr = formatDurationRemaining(totalTaskMinutes).replace(' remaining', '');
    const availStr = `${availableHours} hour${availableHours === 1 ? '' : 's'}`;

    return {
      hasConflict: true,
      totalMinutes: totalTaskMinutes,
      availableMinutes,
      differenceMinutes: diffMinutes,
      diffString: diffStr,
      message: `Your tasks require approximately ${totalStr}, but you have ${availStr} available. You are short by ${diffStr}.`
    };
  }

  return {
    hasConflict: false,
    totalMinutes: totalTaskMinutes,
    availableMinutes,
    differenceMinutes: 0,
    diffString: '0m',
    message: 'Your tasks fit comfortably within your available time.'
  };
}

/**
 * Classifies tasks into the Eisenhower Matrix quadrants.
 */
function analyzePriorities(tasks = []) {
  const pending = tasks.filter(t => !t.completed);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matrix = {
    urgentImportant: [],    // Do First
    importantNotUrgent: [], // Schedule
    urgentNotImportant: [], // Delegate
    neither: []             // Consider Removing
  };

  pending.forEach(task => {
    const isHigh = task.priority === PRIORITIES.HIGH;
    let isUrgent = false;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        isUrgent = true;
      }
    }

    if (isHigh && isUrgent) {
      matrix.urgentImportant.push(task);
    } else if (isHigh || (!isUrgent && task.priority === PRIORITIES.MEDIUM)) {
      matrix.importantNotUrgent.push(task);
    } else if (isUrgent) {
      matrix.urgentNotImportant.push(task);
    } else {
      matrix.neither.push(task);
    }
  });

  const topFocus = [...matrix.urgentImportant, ...matrix.importantNotUrgent].slice(0, 3);

  return {
    totalPending: pending.length,
    matrix,
    topFocus
  };
}

/**
 * Formats user's task list into a clear context prompt for Amazon Bedrock.
 */
function serializeTasksForContext(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 'The user currently has no tasks recorded in LifePilot.';
  }

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  let text = `User Task Context (${pending.length} pending, ${completed.length} completed):\n\n`;

  if (pending.length > 0) {
    text += 'PENDING TASKS:\n';
    pending.forEach((t, i) => {
      text += `${i + 1}. [${t.priority.toUpperCase()}] "${t.title}" | Category: ${t.category} | Due: ${t.dueDate || 'None'} | Est: ${t.timeEstimate || '30m'}\n`;
    });
  } else {
    text += 'All tasks are completed.\n';
  }

  if (completed.length > 0) {
    text += '\nRECENTLY COMPLETED TASKS:\n';
    completed.slice(-5).forEach((t) => {
      text += `- [DONE] "${t.title}" (${t.category})\n`;
    });
  }

  return text;
}

/**
 * Parses assistant responses to extract actionable items (like created tasks or plan schedules).
 */
function extractActionableItems(text) {
  const extracted = {
    detectedTasks: [],
    suggestedPlan: null,
    suggestedActions: []
  };

  if (!text || typeof text !== 'string') return extracted;

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        extracted.detectedTasks = parsed.tasks.map(t => {
          try { return validateTask(t); } catch { return null; }
        }).filter(Boolean);
      }
      if (parsed.plan) {
        extracted.suggestedPlan = parsed.plan;
      }
      if (parsed.actions && Array.isArray(parsed.actions)) {
        extracted.suggestedActions = parsed.actions;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  return extracted;
}

/**
 * Generates an explanation for task prioritization based on its actual metadata.
 */
function getPrioritizationReason(task) {
  if (!task) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!task.dueDate) {
    return task.priority === PRIORITIES.HIGH
      ? 'Prioritized because it is marked as high priority.'
      : 'Scheduled based on standard workflow priority.';
  }

  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} — requires prompt attention.`;
  }
  if (diffDays === 0) {
    return task.priority === PRIORITIES.HIGH
      ? 'Prioritized because it is due today and marked as high priority.'
      : 'Prioritized because it is due today.';
  }
  if (diffDays === 1) {
    return 'Due tomorrow — scheduled early to maintain momentum.';
  }
  return `Due on ${task.dueDate} under ${task.priority.toLowerCase()} priority.`;
}

module.exports = {
  TASK_CATEGORIES,
  PRIORITIES,
  getInitialTasks,
  validateTask,
  parseEstimateToMinutes,
  formatDurationRemaining,
  generateDailySummary,
  computeWorkloadMetrics,
  checkScheduleConflict,
  analyzePriorities,
  serializeTasksForContext,
  extractActionableItems,
  getPrioritizationReason
};
