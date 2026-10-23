/**
 * LifePilot AI — Amazon Bedrock Service
 * Integrates AWS Bedrock Runtime Client (Converse API) for AI generation.
 * Supports Claude 3.5 Sonnet, Claude 3 Haiku, and Amazon Nova.
 * Uses the user's actual tasks as the single source of truth.
 * Tone: Calm, practical, focused on turning intentions into manageable actions.
 */

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const {
  serializeTasksForContext,
  analyzePriorities,
  extractActionableItems,
  computeWorkloadMetrics,
  checkScheduleConflict,
  formatDurationRemaining,
  parseEstimateToMinutes
} = require('../utils/taskManager');

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

let bedrockClient = null;
let lastVerifiedSuccess = false;
let lastSuccessfulRequestTime = null;

function formatUptime(seconds) {
  if (typeof seconds !== 'number' || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getTroubleshootingGuidance(err) {
  if (!err) return '';
  const msg = err.message || '';
  const code = err.name || '';

  if (code === 'AccessDeniedException' || msg.includes('AccessDenied')) {
    return 'IAM permission denied. Ensure your AWS IAM User/Role has policies allowing "bedrock:InvokeModel" and "bedrock:InvokeModelWithResponseStream".';
  }
  if (code === 'ResourceNotFoundException' || msg.includes('model') && msg.includes('not found')) {
    return `Model "${MODEL_ID}" was not found or is not available in ${AWS_REGION}. Go to AWS Bedrock Console > Model Access and request access.`;
  }
  if (code === 'UnrecognizedClientException' || msg.includes('security token') || msg.includes('credentials')) {
    return 'Invalid AWS credentials. Check that AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env are correct and active.';
  }
  if (code === 'ValidationException') {
    return 'Input validation failed. Verify that your BEDROCK_MODEL_ID supports Converse API in this region.';
  }
  if (msg.includes('network') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    return 'Network connection failure reaching AWS endpoints. Check your internet connection or proxy settings.';
  }
  return `Verify that model access is granted for "${MODEL_ID}" in the ${AWS_REGION} Bedrock Console and IAM keys are valid.`;
}

function getBedrockClient() {
  if (!bedrockClient) {
    const config = { region: AWS_REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      };
      if (process.env.AWS_SESSION_TOKEN) {
        config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
      }
    }
    bedrockClient = new BedrockRuntimeClient(config);
  }
  return bedrockClient;
}

function isConfigured() {
  const hasKey = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const isDummy = process.env.AWS_ACCESS_KEY_ID === 'your_aws_access_key_id_here';
  return hasKey && !isDummy;
}

function hasVerifiedConnection() {
  return lastVerifiedSuccess;
}

/**
 * System Prompt for LifePilot Assistant
 */
const SYSTEM_PROMPT = `You are LifePilot Assistant, a personal productivity copilot.
Product message: "LifePilot — Make space for what matters."

CRITICAL RULE: Always use the user's actual task list provided in [CURRENT TASK CONTEXT]. Do NOT invent separate tasks when the user has tasks registered.

Guidelines:
1. Calm, direct, and concise. No excessive enthusiasm, cheerleading, or redundant timestamps.
2. Structure responses cleanly:
   - Brief acknowledgment.
   - Exact tasks referenced with their actual titles, priorities, and durations.
   - Actionable next steps or conflict warnings.
3. Check for schedule conflicts: If total task effort exceeds available time, state the exact shortage and provide options.
4. When planning or creating tasks, include a structured JSON block at the bottom:
\`\`\`json
{
  "tasks": [
    { "title": "Task title", "priority": "High|Medium|Low", "category": "Study|Work|Coding|Health|General", "timeEstimate": "45m", "dueDate": "YYYY-MM-DD" }
  ],
  "plan": {
    "title": "Plan Title",
    "summary": "Brief summary",
    "days": [
      {
        "day": 1,
        "theme": "Theme",
        "items": [
          { "time": "9:00 AM - 10:30 AM", "activity": "Activity", "description": "Details", "category": "Study", "duration": "90m" }
        ]
      }
    ]
  },
  "actions": [
    { "type": "create_plan", "label": "Create my daily plan" }
  ]
}
\`\`\``;

/**
 * Generates dynamic responses strictly using actual task data.
 */
function generateSimulatedResponse(userMessage, currentTasks = []) {
  const lower = userMessage.toLowerCase();
  const pending = currentTasks.filter(t => !t.completed);
  const todayStr = new Date().toISOString().split('T')[0];
  const metrics = computeWorkloadMetrics(currentTasks);

  // 1. Prioritize Tasks (Uses actual tasks)
  if (lower.includes('prioritize') || lower.includes('priority') || lower.includes('eisenhower') || lower.includes('what to do')) {
    if (pending.length === 0) {
      return {
        message: `Your task list is clear. You have no pending items to prioritize. Add a task or ask me to generate a study schedule.`,
        structuredData: { tasks: [] }
      };
    }

    // Sort actual tasks by priority
    const pOrder = { High: 3, Medium: 2, Low: 1 };
    const sorted = [...pending].sort((a, b) => pOrder[b.priority] - pOrder[a.priority]);

    let responseText = `Let's look at your **${pending.length} active tasks**:\n\n`;
    sorted.forEach((t, i) => {
      const dueInfo = t.dueDate ? ` · Due: ${t.dueDate}` : '';
      responseText += `${i + 1}. **${t.title}** — ${t.priority} priority${dueInfo} (${t.timeEstimate || '30m'})\n`;
    });

    const topTask = sorted[0];
    responseText += `\nI recommend starting with **${topTask.title}** because it is marked as ${topTask.priority} priority.`;

    return {
      message: responseText,
      structuredData: {
        actions: [
          { type: 'view_priorities', label: 'View Eisenhower Matrix' },
          { type: 'create_plan', label: 'Create daily plan around priorities' }
        ]
      }
    };
  }

  // 2. Plan My Day (Builds schedule around user's actual tasks)
  if (lower.includes('plan my day') || lower.includes('daily plan') || lower.includes('organize my day') || lower.includes('schedule today') || lower === 'today' || lower === 'plan today') {
    if (pending.length === 0) {
      return {
        message: `Your task list is currently clear. Here is a balanced daily focus template to get you started:\n\n` +
          `- **9:00 AM – 11:00 AM**: Morning Deep Work Block\n` +
          `- **11:30 AM – 12:30 PM**: Communications & Triage\n` +
          `- **1:30 PM – 3:30 PM**: Project Implementation\n` +
          `- **4:00 PM – 4:30 PM**: Daily Wrap-up\n\n` +
          `You can add specific tasks to customize this schedule.`,
        structuredData: {
          plan: {
            title: "Daily Focus Plan",
            summary: "Balanced daily schedule with morning focus and afternoon project execution.",
            days: [
              {
                day: 1,
                theme: "Today's Agenda",
                items: [
                  { time: "9:00 AM - 11:00 AM", activity: "Morning Deep Work Block", description: "Focus on your primary goal without interruptions", category: "Work", duration: "120m" },
                  { time: "11:30 AM - 12:30 PM", activity: "Communications & Triage", description: "Respond to urgent messages and clear administrative items", category: "General", duration: "60m" },
                  { time: "1:30 PM - 3:30 PM", activity: "Project Implementation", description: "Progress key deliverables and review milestones", category: "Coding", duration: "120m" },
                  { time: "4:00 PM - 4:30 PM", activity: "Daily Review & Wrap-up", description: "Review accomplishments and set tomorrow's items", category: "Personal", duration: "30m" }
                ]
              }
            ]
          },
          actions: [
            { type: 'open_add_task', label: 'Add a task' },
            { type: 'create_study_plan', label: 'Generate 5-day Java study plan' }
          ]
        }
      };
    }

    let scheduleItems = [];
    let startHour = 9;
    let startMin = 0;

    pending.slice(0, 4).forEach((task) => {
      const mins = task.estimatedMinutes || parseEstimateToMinutes(task.timeEstimate);
      const endTotalMin = startHour * 60 + startMin + mins;
      const endHour = Math.floor(endTotalMin / 60);
      const endMin = endTotalMin % 60;

      const formatTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const displayM = m < 10 ? `0${m}` : m;
        return `${displayH}:${displayM} ${period}`;
      };

      const timeSlot = `${formatTime(startHour, startMin)} - ${formatTime(endHour, endMin)}`;
      scheduleItems.push({
        time: timeSlot,
        activity: task.title,
        description: task.description || `${task.priority} priority deliverable`,
        category: task.category || 'Work',
        duration: task.timeEstimate || `${mins}m`
      });

      // Add 15 min buffer
      const nextTotalMin = endTotalMin + 15;
      startHour = Math.floor(nextTotalMin / 60);
      startMin = nextTotalMin % 60;
    });

    let text = `Let's organize your day around your active tasks.\n\nI scheduled **${scheduleItems.length} tasks** for today (${metrics.focusTimeString}):\n\n`;
    scheduleItems.forEach((item, i) => {
      text += `${i + 1}. **${item.activity}** (${item.duration}) at ${item.time.split(' - ')[0]}\n`;
    });

    return {
      message: text,
      structuredData: {
        plan: {
          title: "Today's Focus Plan",
          summary: `Day schedule constructed around your ${scheduleItems.length} active tasks.`,
          days: [
            {
              day: 1,
              theme: "Today's Agenda",
              items: scheduleItems
            }
          ]
        },
        actions: [
          { type: 'accept_plan', label: 'Apply plan to workspace' }
        ]
      }
    };
  }

  // 3. Multi-Day Study / Revision Plan (e.g. Java exam in 5 days)
  if (lower.includes('exam') || lower.includes('study') || lower.includes('revision') || lower.includes('java')) {
    const subject = lower.includes('java') ? 'Java' : (lower.match(/(?:for|in)\s+([a-zA-Z0-9#+]+)/i)?.[1] || 'Computer Science');

    return {
      message: `Here is your structured 5-day revision plan for **${subject}** (allocating 2 hours daily):\n\n` +
        `• **Day 1**: Core syntax, primitives, and control flow\n` +
        `• **Day 2**: Methods, arrays, and string handling\n` +
        `• **Day 3**: Object-oriented programming (classes, inheritance, polymorphism)\n` +
        `• **Day 4**: Collections framework and exception handling\n` +
        `• **Day 5**: Full timed mock test and review of difficult topics\n\n` +
        `You can review each day under **My Plans** or convert the activities into tasks with one click.`,
      structuredData: {
        plan: {
          title: `5-Day ${subject} Revision Plan`,
          summary: `5-day preparation plan allocating 2 hours daily from fundamentals to mock practice.`,
          days: [
            {
              day: 1,
              theme: `${subject} Fundamentals & Control Flow`,
              items: [
                { time: "9:00 AM - 10:30 AM", activity: `${subject} syntax, types, and variables`, description: "Review basic language primitives and memory rules", category: "Study", duration: "90m" },
                { time: "11:00 AM - 11:30 AM", activity: "Control flow exercises: loops and branching", description: "Practice conditionals and loop constructs", category: "Coding", duration: "30m" }
              ]
            },
            {
              day: 2,
              theme: "Methods, Arrays & Strings",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "Method definitions, scope, and recursion", description: "Review parameter passing and recursion patterns", category: "Study", duration: "90m" },
                { time: "11:00 AM - 11:30 AM", activity: "1D/2D arrays and string manipulation", description: "Solve array traversal and string immutability exercises", category: "Coding", duration: "30m" }
              ]
            },
            {
              day: 3,
              theme: "Object-Oriented Programming (OOP)",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "Classes, objects, inheritance, and polymorphism", description: "Study core OOP paradigms and interface contracts", category: "Study", duration: "90m" },
                { time: "11:00 AM - 11:30 AM", activity: "OOP design practice problem", description: "Implement a class hierarchy modeling a real scenario", category: "Coding", duration: "30m" }
              ]
            },
            {
              day: 4,
              theme: "Collections & Exception Handling",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "List, Set, and Map implementations", description: "Compare ArrayList, HashSet, and HashMap performance", category: "Study", duration: "90m" },
                { time: "11:00 AM - 11:30 AM", activity: "Try-catch blocks and custom exceptions", description: "Write robust error handling patterns", category: "Coding", duration: "30m" }
              ]
            },
            {
              day: 5,
              theme: "Timed Mock Examination & Review",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "Complete timed practice exam", description: "Simulate test conditions with mixed questions", category: "Study", duration: "90m" },
                { time: "11:00 AM - 11:30 AM", activity: "Review incorrect answers and refine notes", description: "Consolidate edge cases and high-yield concepts", category: "Study", duration: "30m" }
              ]
            }
          ]
        },
        tasks: [
          { title: `Day 1: ${subject} Fundamentals & Control Flow`, priority: "High", category: "Study", timeEstimate: "2h", dueDate: todayStr },
          { title: `Day 2: ${subject} Methods, Arrays & Strings`, priority: "High", category: "Study", timeEstimate: "2h", dueDate: todayStr },
          { title: `Day 3: ${subject} OOP Principles & Classes`, priority: "High", category: "Study", timeEstimate: "2h", dueDate: todayStr },
          { title: `Day 4: ${subject} Collections & Exception Handling`, priority: "High", category: "Study", timeEstimate: "2h", dueDate: todayStr },
          { title: `Day 5: ${subject} Full Practice Exam & Review`, priority: "High", category: "Study", timeEstimate: "2h", dueDate: todayStr }
        ],
        actions: [
          { type: 'view_plans', label: 'View 5-Day Plan' },
          { type: 'convert_all_tasks', label: 'Add all 5 days to tasks' }
        ]
      }
    };
  }

  // 4. Add Task Command
  if (lower.startsWith('add') || lower.includes('create task') || lower.includes('remind me')) {
    let cleanTitle = userMessage
      .replace(/^(please\s+)?(add|create|schedule)\s+(a\s+)?task\s+(to\s+)?/i, '')
      .replace(/^remind me to\s+/i, '')
      .trim();

    if (!cleanTitle) cleanTitle = 'New LifePilot Task';

    let priority = "Medium";
    if (lower.includes('urgent') || lower.includes('asap') || lower.includes('tomorrow') || lower.includes('today')) {
      priority = "High";
    }

    let category = "General";
    if (lower.includes('project') || lower.includes('code') || lower.includes('app') || lower.includes('deploy')) category = "Coding";
    else if (lower.includes('exam') || lower.includes('study') || lower.includes('read')) category = "Study";
    else if (lower.includes('workout') || lower.includes('health') || lower.includes('walk')) category = "Health";
    else if (lower.includes('meeting') || lower.includes('report') || lower.includes('slides') || lower.includes('work')) category = "Work";

    const dueDate = lower.includes('tomorrow')
      ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
      : (lower.includes('today') ? todayStr : null);

    return {
      message: `I've prepared the task **"${cleanTitle}"** under **${category}** with **${priority}** priority${dueDate ? ` (due ${dueDate})` : ''}.`,
      structuredData: {
        tasks: [
          {
            title: cleanTitle,
            priority,
            category,
            dueDate,
            timeEstimate: "45m"
          }
        ],
        actions: [
          { type: 'view_tasks', label: 'View in My Tasks' }
        ]
      }
    };
  }

  // 5. Summarize Tasks
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('my tasks') || lower.includes('status')) {
    if (pending.length === 0) {
      return {
        message: `Your task list is clear. All tasks have been completed.`,
        structuredData: {}
      };
    }

    let text = `You have **${pending.length} pending task${pending.length === 1 ? '' : 's'}** (${metrics.focusTimeString}):\n\n`;
    pending.forEach((t, i) => {
      text += `${i + 1}. **${t.title}** — ${t.priority} priority${t.dueDate ? ` (Due: ${t.dueDate})` : ''}\n`;
    });

    return {
      message: text,
      structuredData: {
        actions: [
          { type: 'view_tasks', label: 'Manage Tasks' },
          { type: 'create_plan', label: 'Plan My Day' }
        ]
      }
    };
  }

  // Default calm response
  return {
    message: `I can help you organize tasks, build revision schedules, and detect schedule conflicts.

Try asking:
- *"Help me plan my day"*
- *"What should I prioritize today?"*
- *"I have five days to prepare for my Java exam. I can study two hours daily."*
- *"Add a task to prepare deployment slides by tomorrow"*`,
    structuredData: {
      actions: [
        { type: 'prompt_plan', label: 'Plan my day' },
        { type: 'prompt_prioritize', label: 'Prioritize my tasks' }
      ]
    }
  };
}

/**
 * Main Assistant Processor
 */
async function processAssistantRequest(userMessage, currentTasks = [], conversationHistory = []) {
  const startTime = Date.now();
  const configured = isConfigured();

  // If AWS Bedrock is not configured, use local simulation mode
  if (!configured) {
    const simResult = generateSimulatedResponse(userMessage, currentTasks);
    return {
      reply: simResult.message,
      structuredData: simResult.structuredData,
      isSimulated: true,
      serviceStatus: 'demo',
      serviceLabel: 'Demo Mode · Sample Responses',
      modelId: 'demo-local',
      latencyMs: Date.now() - startTime
    };
  }

  // Bedrock is configured; execute live AWS Bedrock call
  try {
    const client = getBedrockClient();
    const taskContext = serializeTasksForContext(currentTasks);

    const messages = [];
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(item => {
      if (item.sender === 'user') {
        messages.push({ role: 'user', content: [{ text: item.text }] });
      } else if (item.sender === 'assistant') {
        messages.push({ role: 'assistant', content: [{ text: item.text }] });
      }
    });

    const currentPrompt = `[CURRENT TASK CONTEXT]\n${taskContext}\n\n[USER REQUEST]\n${userMessage}`;
    messages.push({ role: 'user', content: [{ text: currentPrompt }] });

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 1500,
        temperature: 0.3,
        topP: 0.9
      }
    });

    const response = await client.send(command);
    const latencyMs = Date.now() - startTime;
    lastVerifiedSuccess = true;
    lastSuccessfulRequestTime = new Date().toISOString();

    const outputMessage = response.output?.message?.content?.[0]?.text || '';
    const actionable = extractActionableItems(outputMessage);
    const cleanedText = outputMessage.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();

    return {
      reply: cleanedText || outputMessage,
      rawOutput: outputMessage,
      structuredData: actionable,
      isSimulated: false,
      serviceStatus: 'connected',
      serviceLabel: 'Amazon Bedrock Connected',
      modelId: MODEL_ID,
      usage: response.usage,
      latencyMs
    };
  } catch (error) {
    console.error('Amazon Bedrock invocation error:', error.message);
    const latencyMs = Date.now() - startTime;
    lastVerifiedSuccess = false;

    // Fall back to local simulation when live call fails
    const simResult = generateSimulatedResponse(userMessage, currentTasks);
    return {
      reply: simResult.message,
      structuredData: simResult.structuredData,
      isSimulated: true,
      serviceStatus: 'demo',
      serviceLabel: 'Demo Mode · Sample Responses',
      fallbackNotice: `Amazon Bedrock returned: ${error.message}. Serving local demo response.`,
      modelId: MODEL_ID,
      latencyMs
    };
  }
}

/**
 * Diagnostics Test: Attempt an actual Amazon Bedrock model invocation
 */
async function testBedrockConnection() {
  const startTime = Date.now();
  const uptimeStr = formatUptime(process.uptime());

  if (!isConfigured()) {
    return {
      connected: false,
      configured: false,
      statusLabel: 'Demo Mode · Sample Responses',
      message: 'AWS credentials are not configured in .env. Running in local demo mode.',
      region: AWS_REGION,
      modelId: MODEL_ID,
      serverUptime: uptimeStr,
      lastSuccessfulRequest: lastSuccessfulRequestTime,
      troubleshooting: 'To connect to Amazon Bedrock, add your AWS credentials to .env and request Model Access in the AWS Bedrock Console.'
    };
  }

  try {
    const client = getBedrockClient();
    // Verify by actually invoking the configured Bedrock foundation model
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: 'Respond strictly with "Active".' }]
        }
      ],
      inferenceConfig: { maxTokens: 25, temperature: 0.1 }
    });

    const res = await client.send(command);
    const latencyMs = Date.now() - startTime;
    lastVerifiedSuccess = true;
    lastSuccessfulRequestTime = new Date().toISOString();

    const reply = res.output?.message?.content?.[0]?.text || 'Active';

    return {
      connected: true,
      configured: true,
      statusLabel: 'Amazon Bedrock Connected',
      reply,
      region: AWS_REGION,
      modelId: MODEL_ID,
      latencyMs,
      serverUptime: uptimeStr,
      lastSuccessfulRequest: lastSuccessfulRequestTime
    };
  } catch (err) {
    lastVerifiedSuccess = false;
    const latencyMs = Date.now() - startTime;
    return {
      connected: false,
      configured: true,
      statusLabel: 'AI Unavailable',
      error: err.message,
      code: err.name,
      region: AWS_REGION,
      modelId: MODEL_ID,
      latencyMs,
      serverUptime: uptimeStr,
      lastSuccessfulRequest: lastSuccessfulRequestTime,
      troubleshooting: getTroubleshootingGuidance(err)
    };
  }
}

module.exports = {
  processAssistantRequest,
  testBedrockConnection,
  isConfigured,
  hasVerifiedConnection,
  getLastSuccessfulRequestTime: () => lastSuccessfulRequestTime,
  formatUptime,
  AWS_REGION,
  MODEL_ID
};
