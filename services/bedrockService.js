/**
 * LifePilot AI — Amazon Bedrock Service
 * Integrates AWS Bedrock Runtime Client (Converse API) for AI generation.
 * Supports Claude 3.5 Sonnet, Claude 3 Haiku, and Amazon Nova.
 * Implements transparent local simulation when credentials are not configured or service is unreachable.
 * Tone: Calm, practical, focused on turning intentions into manageable actions.
 */

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const {
  serializeTasksForContext,
  analyzePriorities,
  extractActionableItems,
  getPrioritizationReason
} = require('../utils/taskManager');

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

let bedrockClient = null;
let lastVerifiedSuccess = false;

function getBedrockClient() {
  if (!bedrockClient) {
    const config = {
      region: AWS_REGION
    };

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

/**
 * Checks whether Amazon Bedrock credentials appear configured in .env
 */
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
 * Tone: Calm, practical, direct, action-oriented. No excessive enthusiasm or marketing fluff.
 */
const SYSTEM_PROMPT = `You are the LifePilot Assistant.
Product message: "LifePilot — Make space for what matters."

Your role is to help students, developers, and professionals turn intentions into manageable daily actions.

Tone & Guidelines:
1. Calm, direct, and practical. Avoid excessive exclamation marks, hype, or unnecessary filler words.
2. Structure your replies into:
   - A brief, practical acknowledgment.
   - A concrete schedule, task, or priority recommendation.
   - Clear next steps.
3. When prioritizing tasks, explain WHY a task is prioritized using its actual metadata (e.g., due date proximity, priority tag).
4. When planning or creating tasks, provide your conversational advice first, then output a structured JSON block at the bottom in this EXACT schema so the workspace can populate the timeline and task cards:

\`\`\`json
{
  "tasks": [
    {
      "title": "Task title",
      "priority": "High|Medium|Low",
      "category": "Study|Work|Personal|Coding|Health|General",
      "timeEstimate": "45m",
      "dueDate": "YYYY-MM-DD"
    }
  ],
  "plan": {
    "title": "Plan Title",
    "summary": "Brief summary",
    "days": [
      {
        "day": 1,
        "theme": "Day Theme",
        "items": [
          {
            "time": "9:00 AM - 10:30 AM",
            "activity": "Activity name",
            "description": "Details",
            "category": "Study",
            "duration": "90m"
          }
        ]
      }
    ]
  }
}
\`\`\``;

/**
 * Generates structured local responses when running in demo mode.
 */
function generateSimulatedResponse(userMessage, currentTasks = []) {
  const lower = userMessage.toLowerCase();
  const prioritiesData = analyzePriorities(currentTasks);
  const today = new Date().toISOString().split('T')[0];

  // 1. Revision / Exam Schedule (e.g., Java exam in 5 days)
  if (lower.includes('exam') || lower.includes('study') || lower.includes('revision') || lower.includes('java')) {
    const subject = lower.includes('java') ? 'Java' : (lower.match(/(?:for|in)\s+([a-zA-Z0-9#+]+)/i)?.[1] || 'Upcoming Exam');

    return {
      message: `Here is a structured 5-day revision plan for **${subject}**. 

The schedule dedicates two to three hours daily, starting with core principles and building toward mock testing and weak-spot revision:

- **Day 1**: Fundamentals, data types, and control flow
- **Day 2**: Methods, arrays, and string handling
- **Day 3**: Object-oriented programming (classes, inheritance, polymorphism)
- **Day 4**: Collections framework and exception handling
- **Day 5**: Full mock test and review of difficult topics

You can review each day's schedule in **My Plans**, or convert all items into your task board with one click.`,
      structuredData: {
        plan: {
          title: `5-Day ${subject} Revision Plan`,
          summary: `5-day preparation schedule allocating 2-3 hours daily from fundamentals to timed practice.`,
          days: [
            {
              day: 1,
              theme: `${subject} Fundamentals & Control Flow`,
              items: [
                { time: "9:00 AM - 10:30 AM", activity: `${subject} syntax, primitive types, and operators`, description: "Review basic language rules and memory types", category: "Study", duration: "90m" },
                { time: "11:00 AM - 12:30 PM", activity: "Control flow exercises: loops and branching", description: "Practice conditionals and loop constructs with test problems", category: "Coding", duration: "90m" }
              ]
            },
            {
              day: 2,
              theme: "Methods, Arrays & Strings",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "Method definitions, scope, and recursion", description: "Review parameter passing and recursive functions", category: "Study", duration: "90m" },
                { time: "11:00 AM - 12:30 PM", activity: "1D/2D arrays and string manipulation", description: "Solve array traversal and string immutability exercises", category: "Coding", duration: "90m" }
              ]
            },
            {
              day: 3,
              theme: "Object-Oriented Programming (OOP)",
              items: [
                { time: "9:00 AM - 11:00 AM", activity: "Classes, objects, inheritance, and polymorphism", description: "Study core OOP paradigms and interface contracts", category: "Study", duration: "120m" },
                { time: "2:00 PM - 3:30 PM", activity: "OOP design practice problem", description: "Implement a class hierarchy modeling a real-world scenario", category: "Coding", duration: "90m" }
              ]
            },
            {
              day: 4,
              theme: "Collections & Exception Handling",
              items: [
                { time: "9:00 AM - 10:30 AM", activity: "List, Set, and Map implementations", description: "Compare ArrayList, HashSet, and HashMap performance", category: "Study", duration: "90m" },
                { time: "11:00 AM - 12:30 PM", activity: "Try-catch blocks and custom exceptions", description: "Write robust error handling patterns", category: "Coding", duration: "90m" }
              ]
            },
            {
              day: 5,
              theme: "Timed Mock Examination & Review",
              items: [
                { time: "9:00 AM - 11:00 AM", activity: "Complete timed practice exam", description: "Simulate test conditions with 25 mixed questions", category: "Study", duration: "120m" },
                { time: "1:30 PM - 3:00 PM", activity: "Review incorrect answers and refine notes", description: "Consolidate edge cases and high-yield concepts", category: "Study", duration: "90m" }
              ]
            }
          ]
        },
        tasks: [
          { title: `Day 1: ${subject} Fundamentals & Control Flow`, priority: "High", category: "Study", timeEstimate: "3h", dueDate: today },
          { title: `Day 2: ${subject} Methods, Arrays & Strings`, priority: "High", category: "Study", timeEstimate: "3h", dueDate: today },
          { title: `Day 3: ${subject} OOP Principles & Classes`, priority: "High", category: "Study", timeEstimate: "3.5h", dueDate: today },
          { title: `Day 4: ${subject} Collections & Exception Handling`, priority: "High", category: "Study", timeEstimate: "3h", dueDate: today },
          { title: `Day 5: ${subject} Full Practice Exam & Review`, priority: "High", category: "Study", timeEstimate: "3.5h", dueDate: today }
        ]
      }
    };
  }

  // 2. Task Prioritization with Metadata-Based Explanations
  if (lower.includes('prioritize') || lower.includes('priority') || lower.includes('eisenhower') || lower.includes('what to do')) {
    const pending = currentTasks.filter(t => !t.completed);

    if (pending.length === 0) {
      return {
        message: `You currently have no pending tasks. Add a task or say *"Help me plan my day"* to create a new schedule.`,
        structuredData: { tasks: [] }
      };
    }

    let summary = `Here is how your **${pending.length} pending task${pending.length === 1 ? '' : 's'}** are categorized by priority:\n\n`;

    if (prioritiesData.matrix.urgentImportant.length > 0) {
      summary += `**Do First (Urgent & Important):**\n`;
      prioritiesData.matrix.urgentImportant.forEach(t => {
        summary += `- **${t.title}** (${t.category})\n  *Reason: ${getPrioritizationReason(t)}*\n`;
      });
      summary += `\n`;
    }

    if (prioritiesData.matrix.importantNotUrgent.length > 0) {
      summary += `**Schedule (Important, Not Urgent):**\n`;
      prioritiesData.matrix.importantNotUrgent.forEach(t => {
        summary += `- **${t.title}** (${t.category})\n  *Reason: ${getPrioritizationReason(t)}*\n`;
      });
      summary += `\n`;
    }

    if (prioritiesData.matrix.urgentNotImportant.length > 0) {
      summary += `**Quick Wins / Delegate:**\n`;
      prioritiesData.matrix.urgentNotImportant.forEach(t => {
        summary += `- **${t.title}** (${t.category})\n  *Reason: ${getPrioritizationReason(t)}*\n`;
      });
    }

    summary += `\n**Next step:** Start with the first task in your Do First list.`;

    return {
      message: summary,
      structuredData: {
        analysis: prioritiesData
      }
    };
  }

  // 3. Plan My Day
  if (lower.includes('plan my day') || lower.includes('daily plan') || lower.includes('organize my day') || lower.includes('schedule today') || lower === 'today' || lower === 'plan today') {
    return {
      message: `Here is a suggested schedule for today, organized around deep focus in the morning and administrative tasks in the afternoon:

- **9:00 AM – 11:00 AM**: Deep work on your primary task
- **11:30 AM – 12:30 PM**: Communications, messages, and quick follow-ups
- **1:30 PM – 3:30 PM**: Secondary focus block and project work
- **4:00 PM – 4:30 PM**: Daily review and wrap-up

I've populated today's plan on your workspace. You can convert any item to a task as needed.`,
      structuredData: {
        plan: {
          title: "Daily Focus Plan",
          summary: "Balanced schedule with two focus blocks and structured review periods.",
          days: [
            {
              day: 1,
              theme: "Today's Schedule",
              items: [
                { time: "9:00 AM - 11:00 AM", activity: "Deep Work Block: Primary Priority", description: "Focus on your single most critical deliverable without interruptions", category: "Work", duration: "120m" },
                { time: "11:30 AM - 12:30 PM", activity: "Triage & Quick Wins", description: "Respond to urgent messages and clear administrative tasks", category: "General", duration: "60m" },
                { time: "1:30 PM - 3:30 PM", activity: "Secondary Project Implementation", description: "Progress key milestones and review upcoming deadlines", category: "Coding", duration: "120m" },
                { time: "4:00 PM - 4:30 PM", activity: "Daily Review & Next Day Setup", description: "Check off completed tasks and set tomorrow's top 3 items", category: "Personal", duration: "30m" }
              ]
            }
          ]
        },
        tasks: [
          { title: "Complete morning deep work block", priority: "High", category: "Work", timeEstimate: "2h", dueDate: today },
          { title: "Review and respond to key messages", priority: "Medium", category: "General", timeEstimate: "1h", dueDate: today },
          { title: "Project deliverable implementation", priority: "High", category: "Coding", timeEstimate: "2h", dueDate: today }
        ]
      }
    };
  }

  // 4. Add Task
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
    else if (lower.includes('meeting') || lower.includes('report') || lower.includes('work')) category = "Work";

    const dueDate = lower.includes('tomorrow')
      ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
      : (lower.includes('today') ? today : null);

    return {
      message: `I've added **"${cleanTitle}"** to your tasks under **${category}** with **${priority}** priority${dueDate ? ` (due ${dueDate})` : ''}.`,
      structuredData: {
        tasks: [
          {
            title: cleanTitle,
            priority,
            category,
            dueDate,
            timeEstimate: "45m"
          }
        ]
      }
    };
  }

  // 5. Summarize Tasks
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('pending') || lower.includes('status')) {
    const pending = currentTasks.filter(t => !t.completed);
    const completed = currentTasks.filter(t => t.completed);

    if (pending.length === 0 && completed.length === 0) {
      return {
        message: `Your task list is empty. You can add a task or generate a daily plan.`,
        structuredData: {}
      };
    }

    let summaryText = `**Task Summary**: ${pending.length} pending, ${completed.length} completed.\n\n`;
    if (pending.length > 0) {
      summaryText += `**Active Tasks:**\n`;
      pending.forEach((t, i) => {
        summaryText += `${i + 1}. **${t.title}** · ${t.priority} priority (${t.category})${t.dueDate ? ` · Due: ${t.dueDate}` : ''}\n`;
      });
    }

    return {
      message: summaryText,
      structuredData: {}
    };
  }

  // Default calm response
  return {
    message: `I can help you organize tasks, build revision schedules, and prioritize your day.

Try asking:
- *"Plan my day"*
- *"I have five days to prepare for my Java exam. Help me create a revision plan."*
- *"What should I prioritize today?"*
- *"Add a task to complete project slides by tomorrow"*`,
    structuredData: {}
  };
}

/**
 * Main Assistant Processor
 */
async function processAssistantRequest(userMessage, currentTasks = [], conversationHistory = []) {
  const startTime = Date.now();
  const configured = isConfigured();

  // If not configured, transparently use demo mode
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
        temperature: 0.5,
        topP: 0.9
      }
    });

    const response = await client.send(command);
    const latencyMs = Date.now() - startTime;
    lastVerifiedSuccess = true;

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
 * Diagnostics Test Handshake
 */
async function testBedrockConnection() {
  const startTime = Date.now();
  if (!isConfigured()) {
    return {
      connected: false,
      configured: false,
      statusLabel: 'Demo Mode · Sample Responses',
      message: 'AWS credentials not configured in .env. Running in Demo Mode.',
      region: AWS_REGION,
      modelId: MODEL_ID
    };
  }

  try {
    const client = getBedrockClient();
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: 'Health check. Respond with "Active".' }] }],
      inferenceConfig: { maxTokens: 20, temperature: 0.1 }
    });

    const res = await client.send(command);
    lastVerifiedSuccess = true;
    return {
      connected: true,
      configured: true,
      statusLabel: 'Amazon Bedrock Connected',
      reply: res.output?.message?.content?.[0]?.text || '',
      region: AWS_REGION,
      modelId: MODEL_ID,
      latencyMs: Date.now() - startTime
    };
  } catch (err) {
    lastVerifiedSuccess = false;
    return {
      connected: false,
      configured: true,
      statusLabel: 'AI Offline · Retry',
      error: err.message,
      code: err.name,
      region: AWS_REGION,
      modelId: MODEL_ID,
      latencyMs: Date.now() - startTime
    };
  }
}

module.exports = {
  processAssistantRequest,
  testBedrockConnection,
  isConfigured,
  hasVerifiedConnection,
  AWS_REGION,
  MODEL_ID
};
