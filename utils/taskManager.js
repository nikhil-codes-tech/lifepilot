/**
 * LifePilot AI — Task Management & Scheduling Utilities
 * Handles task validation, prioritization (Eisenhower Matrix),
 * context serialization for Bedrock prompts, and plan structuring.
 */

// Categories supported by LifePilot AI
const TASK_CATEGORIES = ['Study', 'Work', 'Personal', 'Coding', 'Health', 'General'];

// Priority levels
const PRIORITIES = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
};

/**
 * Normalizes and validates a task object.
 * @param {Object} rawTask
 * @returns {Object} Validated task object
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

  return {
    id: rawTask.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: rawTask.title.trim(),
    priority,
    category,
    dueDate: rawTask.dueDate || null,
    timeEstimate: rawTask.timeEstimate || '30m',
    completed: Boolean(rawTask.completed),
    createdAt: rawTask.createdAt || new Date().toISOString(),
    completedAt: rawTask.completed ? (rawTask.completedAt || new Date().toISOString()) : null
  };
}

/**
 * Formats user's task list into a clear context prompt for Amazon Bedrock.
 * @param {Array} tasks - Array of task objects
 * @returns {string} Contextual string representation
 */
function serializeTasksForContext(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 'Currently, the user has no active tasks registered in LifePilot AI.';
  }

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  let text = `User Task Context (${pending.length} pending, ${completed.length} completed):\n\n`;

  if (pending.length > 0) {
    text += 'PENDING TASKS:\n';
    pending.forEach((t, i) => {
      text += `${i + 1}. [${t.priority.toUpperCase()}] "${t.title}" | Category: ${t.category} | Due: ${t.dueDate || 'No deadline'} | Est: ${t.timeEstimate || '30m'}\n`;
    });
  } else {
    text += 'All tasks have been completed! Clean slate.\n';
  }

  if (completed.length > 0) {
    text += '\nRECENTLY COMPLETED TASKS:\n';
    completed.slice(-5).forEach((t, i) => {
      text += `- [DONE] "${t.title}" (${t.category})\n`;
    });
  }

  return text;
}

/**
 * Analyzes tasks and calculates prioritization metrics using the Eisenhower Matrix.
 * @param {Array} tasks
 * @returns {Object} Prioritized groupings and recommendations
 */
function analyzePriorities(tasks = []) {
  const pending = tasks.filter(t => !t.completed);

  // Classify by urgency & importance
  const matrix = {
    urgentImportant: [],    // Do First (High priority with tight deadline or high urgency)
    importantNotUrgent: [], // Schedule (High/Med priority, long-term or study)
    urgentNotImportant: [], // Delegate or Quick Win (Low effort, immediate)
    neither: []             // Eliminate or Later
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  return {
    totalPending: pending.length,
    matrix,
    topFocus: matrix.urgentImportant.concat(matrix.importantNotUrgent).slice(0, 3)
  };
}

/**
 * Parses assistant responses to extract actionable items (like created tasks or plan schedules).
 * @param {string} text - Response text
 * @returns {Object} Extracted data
 */
function extractActionableItems(text) {
  const extracted = {
    detectedTasks: [],
    suggestedPlan: null
  };

  if (!text || typeof text !== 'string') return extracted;

  // Check for JSON blocks (e.g. ```json ... ```)
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
      // Ignore JSON parsing errors, will fallback to conversational text
    }
  }

  return extracted;
}

module.exports = {
  TASK_CATEGORIES,
  PRIORITIES,
  validateTask,
  serializeTasksForContext,
  analyzePriorities,
  extractActionableItems
};
