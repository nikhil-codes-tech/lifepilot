/**
 * LifePilot AI — Task Management & Scheduling Utilities
 * Handles task validation, prioritization (Eisenhower Matrix),
 * workload metrics, metadata-based explanations, and context serialization.
 */

const TASK_CATEGORIES = ['Study', 'Work', 'Personal', 'Coding', 'Health', 'General'];

const PRIORITIES = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/**
 * Parses time estimate strings (e.g., '45m', '2h', '1.5h', '90m') into minutes.
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
 * Formats minutes into human-readable string (e.g. '2.5 hours', '45 mins').
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} mins`;
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '');
  return `${hours} hour${hours === '1' ? '' : 's'}`;
}

/**
 * Validates and normalizes a task object.
 */
function validateTask(rawTask = {}) {
  if (!rawTask.title || typeof rawTask.title !== 'string' || !rawTask.title.trim()) {
    throw new Error('Task title is required');
  }

  const priority = Object.values(PRIORITIES).includes(rawTask.priority)
    ? rawTask.priority
    : PRIORITIES.MEDIUM;

  const category = TASK_CATEGORIES.includes(rawTask.category)
    ? rawTask.category
    : 'General';

  const minutes = parseEstimateToMinutes(rawTask.timeEstimate || '30m');

  return {
    id: rawTask.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: rawTask.title.trim(),
    description: typeof rawTask.description === 'string' ? rawTask.description.trim() : '',
    priority,
    category,
    dueDate: rawTask.dueDate || null,
    timeEstimate: rawTask.timeEstimate || '30m',
    estimatedMinutes: minutes,
    completed: Boolean(rawTask.completed),
    createdAt: rawTask.createdAt || new Date().toISOString(),
    completedAt: rawTask.completed ? (rawTask.completedAt || new Date().toISOString()) : null
  };
}

/**
 * Generates an explanation of why a task was prioritized based on its actual metadata.
 */
function getPrioritizationReason(task) {
  if (!task) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!task.dueDate) {
    if (task.priority === PRIORITIES.HIGH) {
      return 'Prioritized because it is marked as high importance.';
    }
    return 'Scheduled based on standard workflow priority.';
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
    return 'Due tomorrow — scheduling early to maintain momentum.';
  }
  if (diffDays <= 3 && task.priority === PRIORITIES.HIGH) {
    return `Due in ${diffDays} days with high impact on your schedule.`;
  }
  return `Due on ${task.dueDate}; categorized under ${task.priority.toLowerCase()} priority.`;
}

/**
 * Computes workload statistics for the dashboard overview.
 */
function computeWorkloadMetrics(tasks = []) {
  const total = tasks.length;
  const completedTasks = tasks.filter(t => t.completed);
  const pendingTasks = tasks.filter(t => !t.completed);

  const pendingMinutes = pendingTasks.reduce((sum, t) => sum + (t.estimatedMinutes || parseEstimateToMinutes(t.timeEstimate)), 0);

  return {
    totalTasks: total,
    completedCount: completedTasks.length,
    pendingCount: pendingTasks.length,
    completionPercentage: total > 0 ? Math.round((completedTasks.length / total) * 100) : 0,
    totalFocusMinutes: pendingMinutes,
    focusTimeString: formatMinutes(pendingMinutes)
  };
}

/**
 * Analyzes tasks and classifies them into the Eisenhower Matrix quadrants.
 */
function analyzePriorities(tasks = []) {
  const pending = tasks.filter(t => !t.completed);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matrix = {
    urgentImportant: [],    // Q1: Do First
    importantNotUrgent: [], // Q2: Schedule
    urgentNotImportant: [], // Q3: Delegate / Quick Wins
    neither: []             // Q4: Eliminate / Later
  };

  pending.forEach(task => {
    const isHigh = task.priority === PRIORITIES.HIGH;
    let isUrgent = false;

    if (task.dueDate) {
      const due = new Date(task.dueDate);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        isUrgent = true;
      }
    }

    const annotatedTask = {
      ...task,
      priorityReason: getPrioritizationReason(task)
    };

    if (isHigh && isUrgent) {
      matrix.urgentImportant.push(annotatedTask);
    } else if (isHigh || (!isUrgent && task.priority === PRIORITIES.MEDIUM)) {
      matrix.importantNotUrgent.push(annotatedTask);
    } else if (isUrgent) {
      matrix.urgentNotImportant.push(annotatedTask);
    } else {
      matrix.neither.push(annotatedTask);
    }
  });

  // Top focus items (Q1 then Q2, limit to 3)
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
    suggestedPlan: null
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
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  return extracted;
}

module.exports = {
  TASK_CATEGORIES,
  PRIORITIES,
  validateTask,
  parseEstimateToMinutes,
  formatMinutes,
  getPrioritizationReason,
  computeWorkloadMetrics,
  analyzePriorities,
  serializeTasksForContext,
  extractActionableItems
};
