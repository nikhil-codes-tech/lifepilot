/**
 * LifePilot AI — Amazon Bedrock Service
 * Integrates AWS Bedrock Runtime Client (Converse API) for AI generation.
 * Supports Claude 3.5 Sonnet, Claude 3 Haiku, Amazon Nova, and Llama 3 models.
 * Implements transparent fallback simulation when credentials are not configured or service is unreachable.
 */

const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { serializeTasksForContext, analyzePriorities, extractActionableItems } = require('../utils/taskManager');

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

// Initialize AWS Bedrock Client
let bedrockClient = null;

function getBedrockClient() {
  if (!bedrockClient) {
    const config = {
      region: AWS_REGION
    };

    // If explicit keys provided in environment, configure credentials
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
 * Checks whether Amazon Bedrock credentials are fully provided in .env
 */
function isConfigured() {
  const hasKey = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  const isDummy = process.env.AWS_ACCESS_KEY_ID === 'your_aws_access_key_id_here';
  return hasKey && !isDummy;
}

/**
 * Alexa+ Style System Prompt for LifePilot AI
 */
const SYSTEM_PROMPT = `You are LifePilot AI, a next-generation personal productivity copilot inspired by Alexa+.
You help students, professionals, and developers organize their daily schedules, prioritize tasks, create exam/project revision roadmaps, and conquer procrastination.

Your personality:
- Conversational, warm, crisp, and proactive—embodying an intelligent voice-first Alexa+ experience.
- Provide structured, practical advice rather than vague platitudes.
- Time-conscious: suggest concrete timeblocks (e.g., 09:00 AM - 10:30 AM).

Formatting & Action Directives:
1. When generating daily plans, study schedules, or newly identified tasks, ALWAYS include a structured JSON block at the bottom of your response in this EXACT format so the LifePilot dashboard can render interactive task cards and plan timelines:
\`\`\`json
{
  "tasks": [
    { "title": "Task title", "priority": "High|Medium|Low", "category": "Study|Work|Personal|Coding|Health", "timeEstimate": "45m", "dueDate": "YYYY-MM-DD" }
  ],
  "plan": {
    "title": "Plan Title",
    "summary": "Brief summary",
    "days": [
      {
        "day": 1,
        "theme": "Theme for the day",
        "items": [
          { "time": "09:00 AM - 10:30 AM", "activity": "Activity name", "description": "Details", "category": "Study", "duration": "90m" }
        ]
      }
    ]
  }
}
\`\`\`
2. Keep the conversational dialogue above the JSON block clean, motivating, and easy to read (or listen to via speech synthesis).
3. If the user asks for a revision plan (e.g. Java exam in 5 days), create a complete, well-paced day-by-day plan.
4. If the user asks to prioritize or summarize tasks, refer explicitly to their current task context.`;

/**
 * Generates an intelligent, high-fidelity local response when Bedrock is offline or credentials are not supplied.
 * Implements all sample use cases from the PDR (Section 11, 12).
 */
function generateSimulatedResponse(userMessage, currentTasks = []) {
  const lower = userMessage.toLowerCase();
  const prioritiesData = analyzePriorities(currentTasks);
  const today = new Date().toISOString().split('T')[0];

  // Use Case 1: Exam / Study revision schedule (e.g., Java exam in 5 days)
  if (lower.includes('exam') || lower.includes('study') || lower.includes('revision') || lower.includes('java')) {
    const subject = lower.includes('java') ? 'Java' : (lower.match(/(?:for|in)\s+([a-zA-Z0-9#+]+)/i)?.[1] || 'Upcoming Exam');
    
    return {
      message: `Here is your customized 5-day intensive revision roadmap for **${subject}**! 

I've structured this plan using spaced repetition and active recall: mastering fundamentals first, moving into object-oriented principles and problem-solving, and reserving the final day for mock tests and weak areas.

You can click **"Add All to Tasks"** on the right panel to instantly populate these study milestones into your active task board!`,
      structuredData: {
        plan: {
          title: `5-Day ${subject} Exam Preparation Plan`,
          summary: `Comprehensive syllabus breakdown across 5 focused preparation days.`,
          days: [
            {
              day: 1,
              theme: `${subject} Core Fundamentals & Syntax`,
              items: [
                { time: "09:00 AM - 11:00 AM", activity: `${subject} Environment, JVM/JDK architecture & primitive data types`, category: "Study", duration: "120m" },
                { time: "02:00 PM - 04:00 PM", activity: "Control flow: conditionals, switch-case, and loop optimization", category: "Coding", duration: "120m" },
                { time: "05:00 PM - 06:00 PM", activity: "Flashcard review: memory stack vs heap allocations", category: "Study", duration: "60m" }
              ]
            },
            {
              day: 2,
              theme: "Methods, Arrays & Functional Foundations",
              items: [
                { time: "09:30 AM - 11:30 AM", activity: "Method overloading, parameter passing & recursion", category: "Study", duration: "120m" },
                { time: "02:00 PM - 04:30 PM", activity: "1D & 2D Array manipulations, String & StringBuilder immutability", category: "Coding", duration: "150m" }
              ]
            },
            {
              day: 3,
              theme: "Object-Oriented Programming (OOP) Deep Dive",
              items: [
                { time: "09:00 AM - 11:30 AM", activity: "Encapsulation, Inheritance, Polymorphism & Abstraction", category: "Study", duration: "150m" },
                { time: "02:00 PM - 04:00 PM", activity: "Interface contracts vs Abstract classes practical coding", category: "Coding", duration: "120m" },
                { time: "05:00 PM - 06:30 PM", activity: "Constructors, super(), this(), and access specifiers practice", category: "Study", duration: "90m" }
              ]
            },
            {
              day: 4,
              theme: "Collections Framework & Exception Handling",
              items: [
                { time: "09:00 AM - 11:30 AM", activity: "List (ArrayList/LinkedList), Set (HashSet), Map (HashMap) internals", category: "Study", duration: "150m" },
                { time: "02:00 PM - 04:00 PM", activity: "Try-catch-finally, checked vs unchecked exceptions, custom exceptions", category: "Coding", duration: "120m" },
                { time: "05:00 PM - 07:00 PM", activity: "Solve 5 top exam practice questions on Collections", category: "Coding", duration: "120m" }
              ]
            },
            {
              day: 5,
              theme: "Timed Mock Examination & Weak-Spot Review",
              items: [
                { time: "09:00 AM - 11:30 AM", activity: "Complete full 2.5-hour simulated timed mock test", category: "Study", duration: "150m" },
                { time: "02:00 PM - 04:00 PM", activity: "Error analysis: review incorrect mock questions and edge cases", category: "Study", duration: "120m" },
                { time: "05:00 PM - 06:00 PM", activity: "High-yield formula & syntax cheat sheet review + rest", category: "Health", duration: "60m" }
              ]
            }
          ]
        },
        tasks: [
          { title: `Day 1: ${subject} Fundamentals, data types & control flow`, priority: "High", category: "Study", timeEstimate: "4h", dueDate: today },
          { title: `Day 2: ${subject} Arrays, Strings & method recursion practice`, priority: "High", category: "Study", timeEstimate: "4h", dueDate: today },
          { title: `Day 3: OOP Principles (Inheritance, Polymorphism, Interfaces)`, priority: "High", category: "Study", timeEstimate: "5h", dueDate: today },
          { title: `Day 4: Collections Framework & Exception Handling problems`, priority: "High", category: "Study", timeEstimate: "4.5h", dueDate: today },
          { title: `Day 5: Full Timed Mock Test & revision of weak topics`, priority: "High", category: "Study", timeEstimate: "4h", dueDate: today }
        ]
      }
    };
  }

  // Use Case 2: Plan my day
  if (lower.includes('plan my day') || lower.includes('daily plan') || lower.includes('organize my day') || lower.includes('schedule today')) {
    return {
      message: `I've constructed an optimized daily schedule tailored for peak focus and balanced productivity today! 

Your morning is protected for deep-work cognitive tasks, while the afternoon accommodates meetings, collaboration, and follow-ups, with dedicated time for physical wellbeing.`,
      structuredData: {
        plan: {
          title: "Optimized High-Performance Daily Plan",
          summary: "Balanced schedule featuring 2 deep-work blocks, buffer time, and evening wind-down.",
          days: [
            {
              day: 1,
              theme: "Today's Agenda",
              items: [
                { time: "08:30 AM - 09:00 AM", activity: "Morning Routine & Day Setup: Review goals in LifePilot AI", category: "Personal", duration: "30m" },
                { time: "09:00 AM - 11:30 AM", activity: "Deep Work Block 1: Most critical priority & high-leverage focus", category: "Work", duration: "150m" },
                { time: "11:30 AM - 12:00 PM", activity: "Quick recharge walk & hydration break", category: "Health", duration: "30m" },
                { time: "12:00 PM - 01:00 PM", activity: "Inbox processing, task triage, and team check-ins", category: "Work", duration: "60m" },
                { time: "01:00 PM - 02:00 PM", activity: "Nutritious lunch & screen-free rest", category: "Health", duration: "60m" },
                { time: "02:00 PM - 04:00 PM", activity: "Deep Work Block 2: Project deliverables & coding/review", category: "Coding", duration: "120m" },
                { time: "04:30 PM - 05:30 PM", activity: "Administrative wrap-up & day reflection", category: "Personal", duration: "60m" }
              ]
            }
          ]
        },
        tasks: [
          { title: "Complete Deep Work Block 1 (Top Priority)", priority: "High", category: "Work", timeEstimate: "2.5h", dueDate: today },
          { title: "Team sync & message review", priority: "Medium", category: "Work", timeEstimate: "1h", dueDate: today },
          { title: "Project deliverable implementation", priority: "High", category: "Coding", timeEstimate: "2h", dueDate: today },
          { title: "Evening walk & daily review", priority: "Low", category: "Health", timeEstimate: "45m", dueDate: today }
        ]
      }
    };
  }

  // Use Case 3: Prioritize tasks / What should I prioritize today
  if (lower.includes('prioritize') || lower.includes('priority') || lower.includes('what should i do first') || lower.includes('eisenhower')) {
    const pendingCount = prioritiesData.totalPending;
    
    if (pendingCount === 0) {
      return {
        message: `You currently have **no pending tasks** on your board! 
        
You have a clean slate. Tell me what projects, deadlines, or goals you're tackling, or say:
- *"Help me plan my day"*
- *"I have a Java exam in 5 days"*
- *"Add task: Deploy web application by tomorrow"*`,
        structuredData: { tasks: [] }
      };
    }

    const urgentCount = prioritiesData.matrix.urgentImportant.length;
    const importantCount = prioritiesData.matrix.importantNotUrgent.length;

    let response = `Based on the **Eisenhower Decision Matrix**, here is your priority analysis for ${pendingCount} pending task${pendingCount > 1 ? 's' : ''}:\n\n`;
    
    if (urgentCount > 0) {
      response += `🚨 **Quadrant 1 (Do First — Urgent & Critical):**\n`;
      prioritiesData.matrix.urgentImportant.forEach(t => {
        response += `- **${t.title}** (${t.category}) — Due: ${t.dueDate || 'Immediate'}\n`;
      });
      response += `\n`;
    }

    if (importantCount > 0) {
      response += `⭐ **Quadrant 2 (Schedule — High Impact & Growth):**\n`;
      prioritiesData.matrix.importantNotUrgent.forEach(t => {
        response += `- **${t.title}** (${t.category})\n`;
      });
      response += `\n`;
    }

    response += `💡 **Alexa+ Recommendation:** Focus solely on Quadrant 1 tasks this morning. Eliminate distractions before taking on low-urgency tasks.`;

    return {
      message: response,
      structuredData: {
        analysis: prioritiesData
      }
    };
  }

  // Use Case 4: Add task request
  if (lower.startsWith('add task') || lower.startsWith('create task') || lower.includes('add a task') || lower.includes('remind me to')) {
    let cleanTitle = userMessage
      .replace(/^(please\s+)?(add|create|schedule)\s+(a\s+)?task\s+(to\s+)?/i, '')
      .replace(/^remind me to\s+/i, '')
      .trim();

    if (!cleanTitle) cleanTitle = 'New LifePilot Task';

    let priority = "Medium";
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('asap') || lower.includes('tomorrow') || lower.includes('exam')) {
      priority = "High";
    }

    let category = "General";
    if (lower.includes('project') || lower.includes('code') || lower.includes('deploy') || lower.includes('app')) category = "Coding";
    else if (lower.includes('exam') || lower.includes('study') || lower.includes('read') || lower.includes('revise')) category = "Study";
    else if (lower.includes('workout') || lower.includes('health') || lower.includes('doctor') || lower.includes('gym')) category = "Health";
    else if (lower.includes('client') || lower.includes('meeting') || lower.includes('report') || lower.includes('office')) category = "Work";

    return {
      message: `I've prepared the task **"${cleanTitle}"** with **${priority}** priority in category **${category}**. I've added it directly to your task board!`,
      structuredData: {
        tasks: [
          {
            title: cleanTitle,
            priority,
            category,
            timeEstimate: "45m",
            dueDate: lower.includes('tomorrow') ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : today
          }
        ]
      }
    };
  }

  // Use Case 5: Summarize pending tasks
  if (lower.includes('summarize') || lower.includes('summary') || lower.includes('my tasks') || lower.includes('status')) {
    const pending = currentTasks.filter(t => !t.completed);
    const completed = currentTasks.filter(t => t.completed);

    if (pending.length === 0 && completed.length === 0) {
      return {
        message: `Your task board is completely empty right now. Would you like me to generate a schedule or add your first task?`,
        structuredData: {}
      };
    }

    let summaryText = `Here is your current **LifePilot Productivity Overview**:\n\n`;
    summaryText += `📊 **Metrics:** ${pending.length} pending | ${completed.length} completed\n\n`;
    
    if (pending.length > 0) {
      summaryText += `**Pending Action Items:**\n`;
      pending.forEach((t, i) => {
        const badge = t.priority === 'High' ? '🔴' : (t.priority === 'Medium' ? '🟡' : '🟢');
        summaryText += `${i + 1}. ${badge} **${t.title}** [${t.category}]${t.dueDate ? ` - Due: ${t.dueDate}` : ''}\n`;
      });
    }

    if (completed.length > 0) {
      summaryText += `\n🎉 **Completed Accomplishments:** ${completed.length} tasks finished so far. Keep up the great momentum!`;
    }

    return {
      message: summaryText,
      structuredData: {}
    };
  }

  // General conversational assistant response
  return {
    message: `I'm your **LifePilot AI Assistant**. I can help you orchestrate your day, organize study schedules, and prioritize your workload.

Try asking me:
- *"I have a Java exam in 5 days. Create a revision schedule."*
- *"Help me plan my day."*
- *"What should I prioritize today?"*
- *"Add a task to complete my project by tomorrow."*
- *"Summarize my pending tasks."*`,
    structuredData: {}
  };
}

/**
 * Invokes Amazon Bedrock Runtime with the user query and context.
 * Falls back transparently to local simulation if credentials are not configured or invocation fails.
 */
async function processAssistantRequest(userMessage, currentTasks = [], conversationHistory = []) {
  const startTime = Date.now();
  const configured = isConfigured();

  // If not configured, use local simulation mode immediately with clear metadata
  if (!configured) {
    const simResult = generateSimulatedResponse(userMessage, currentTasks);
    return {
      reply: simResult.message,
      structuredData: simResult.structuredData,
      isSimulated: true,
      service: 'LifePilot Simulation Engine (Local)',
      modelId: 'demo-local-simulation',
      note: 'Amazon Bedrock credentials are not configured in .env. Running in interactive hackathon demo mode.',
      latencyMs: Date.now() - startTime
    };
  }

  // Bedrock is configured; execute live Bedrock ConverseCommand
  try {
    const client = getBedrockClient();
    const taskContext = serializeTasksForContext(currentTasks);

    // Prepare messages for ConverseCommand
    // Include last few history turns for multi-turn context
    const messages = [];

    // Add previous history (limit to last 6 messages to stay focused)
    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(item => {
      if (item.sender === 'user') {
        messages.push({
          role: 'user',
          content: [{ text: item.text }]
        });
      } else if (item.sender === 'assistant' || item.sender === 'bot') {
        messages.push({
          role: 'assistant',
          content: [{ text: item.text }]
        });
      }
    });

    // Add current user turn with current task context
    const currentPrompt = `[CURRENT TASK CONTEXT]\n${taskContext}\n\n[USER REQUEST]\n${userMessage}`;
    messages.push({
      role: 'user',
      content: [{ text: currentPrompt }]
    });

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.7,
        topP: 0.9
      }
    });

    const response = await client.send(command);
    const latencyMs = Date.now() - startTime;

    // Extract text from Bedrock Converse response
    const outputMessage = response.output?.message?.content?.[0]?.text || '';
    
    // Extract any structured JSON actions (tasks, plans)
    const actionable = extractActionableItems(outputMessage);

    // Clean conversational markdown by removing the JSON code block for clean speech and visual display
    const cleanedText = outputMessage.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();

    return {
      reply: cleanedText || outputMessage,
      rawOutput: outputMessage,
      structuredData: actionable,
      isSimulated: false,
      service: 'Amazon Bedrock (AWS Builder)',
      modelId: MODEL_ID,
      usage: response.usage,
      latencyMs
    };
  } catch (error) {
    console.error('Amazon Bedrock invocation encountered an error:', error.message);
    const latencyMs = Date.now() - startTime;

    // Fall back to intelligent simulation and clearly declare fallback reason
    const simResult = generateSimulatedResponse(userMessage, currentTasks);
    return {
      reply: simResult.message,
      structuredData: simResult.structuredData,
      isSimulated: true,
      service: 'LifePilot Simulation Engine (Fallback)',
      modelId: MODEL_ID,
      fallbackReason: `AWS Bedrock returned: ${error.message}. Switched to local fallback.`,
      note: 'Amazon Bedrock request failed (check AWS permissions / model access). Showing simulated response.',
      latencyMs
    };
  }
}

/**
 * Direct diagnostic test to verify Amazon Bedrock connectivity.
 */
async function testBedrockConnection() {
  const startTime = Date.now();
  if (!isConfigured()) {
    return {
      connected: false,
      configured: false,
      message: 'AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not configured in .env',
      region: AWS_REGION,
      modelId: MODEL_ID
    };
  }

  try {
    const client = getBedrockClient();
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      messages: [
        {
          role: 'user',
          content: [{ text: 'Hello Bedrock! Confirm you are active by replying: "LifePilot Bedrock Online".' }]
        }
      ],
      inferenceConfig: {
        maxTokens: 50,
        temperature: 0.1
      }
    });

    const res = await client.send(command);
    const reply = res.output?.message?.content?.[0]?.text || '';

    return {
      connected: true,
      configured: true,
      reply,
      region: AWS_REGION,
      modelId: MODEL_ID,
      latencyMs: Date.now() - startTime
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
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
  AWS_REGION,
  MODEL_ID
};
