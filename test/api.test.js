/**
 * LifePilot AI — Test Suite
 * Tests utility functions, task management, prioritization logic,
 * simulation engine, and API endpoints.
 */

const assert = require('assert');
const {
  validateTask,
  analyzePriorities,
  serializeTasksForContext,
  extractActionableItems,
  getPrioritizationReason,
  computeWorkloadMetrics
} = require('../utils/taskManager');
const bedrockService = require('../services/bedrockService');

async function runTests() {
  console.log('🧪 Starting LifePilot AI Automated Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
    }
  }

  // Unit Test 1: Task Validation
  test('Task validation assigns defaults and formats fields', () => {
    const raw = { title: 'Study for Java Exam' };
    const task = validateTask(raw);
    assert.strictEqual(task.title, 'Study for Java Exam');
    assert.strictEqual(task.priority, 'Medium');
    assert.strictEqual(task.category, 'General');
    assert.strictEqual(task.completed, false);
    assert(task.id.startsWith('task_'));
  });

  // Unit Test 2: Task Validation throws on empty title
  test('Task validation throws error when title is empty', () => {
    assert.throws(() => validateTask({ title: '   ' }), /Task title is required/);
  });

  // Unit Test 3: Priority & Eisenhower Matrix Analysis
  test('Prioritization properly classifies tasks into Eisenhower quadrants', () => {
    const today = new Date().toISOString().split('T')[0];
    const tasks = [
      { id: '1', title: 'Critical Exam', priority: 'High', category: 'Study', dueDate: today, completed: false },
      { id: '2', title: 'Long-term thesis', priority: 'High', category: 'Study', dueDate: null, completed: false },
      { id: '3', title: 'Buy snacks', priority: 'Low', category: 'Personal', dueDate: null, completed: false },
      { id: '4', title: 'Finished homework', priority: 'Medium', category: 'Study', completed: true }
    ];

    const analysis = analyzePriorities(tasks);
    assert.strictEqual(analysis.totalPending, 3);
    assert.strictEqual(analysis.matrix.urgentImportant.length, 1);
    assert.strictEqual(analysis.matrix.urgentImportant[0].title, 'Critical Exam');
    assert.strictEqual(analysis.matrix.importantNotUrgent.length, 1);
    assert.strictEqual(analysis.matrix.neither.length, 1);
  });

  // Unit Test 4: Task Context Serialization
  test('serializeTasksForContext returns formatted context string', () => {
    const tasks = [
      { id: '1', title: 'Deploy to AWS', priority: 'High', category: 'Coding', completed: false }
    ];
    const context = serializeTasksForContext(tasks);
    assert(context.includes('PENDING TASKS'));
    assert(context.includes('Deploy to AWS'));
  });

  // Unit Test 5: Extract Actionable Items from JSON Block
  test('extractActionableItems extracts structured tasks and plans from markdown', () => {
    const markdown = `
Here is your plan:
\`\`\`json
{
  "tasks": [
    { "title": "Revise Java Loops", "priority": "High", "category": "Study" }
  ],
  "plan": {
    "title": "Java 5-Day Plan",
    "days": []
  }
}
\`\`\`
Have a great study session!`;

    const extracted = extractActionableItems(markdown);
    assert.strictEqual(extracted.detectedTasks.length, 1);
    assert.strictEqual(extracted.detectedTasks[0].title, 'Revise Java Loops');
    assert.strictEqual(extracted.suggestedPlan.title, 'Java 5-Day Plan');
  });

  // Unit Test 6: Metadata-based Prioritization Reason Generation
  test('getPrioritizationReason generates explanation from actual metadata', () => {
    const today = new Date().toISOString().split('T')[0];
    const task = {
      title: 'Complete Java assignment',
      priority: 'High',
      dueDate: today
    };
    const reason = getPrioritizationReason(task);
    assert(reason.includes('due today and marked as high priority') || reason.includes('due today'));
  });

  // Unit Test 7: Workload Metrics Calculation
  test('computeWorkloadMetrics accurately calculates counts and focus time', () => {
    const tasks = [
      { id: '1', title: 'Task 1', priority: 'High', timeEstimate: '2h', estimatedMinutes: 120, completed: false },
      { id: '2', title: 'Task 2', priority: 'Medium', timeEstimate: '30m', estimatedMinutes: 30, completed: false },
      { id: '3', title: 'Task 3', priority: 'Low', timeEstimate: '45m', estimatedMinutes: 45, completed: true }
    ];
    const metrics = computeWorkloadMetrics(tasks);
    assert.strictEqual(metrics.totalTasks, 3);
    assert.strictEqual(metrics.completedCount, 1);
    assert.strictEqual(metrics.pendingCount, 2);
    assert.strictEqual(metrics.totalFocusMinutes, 150);
    assert(metrics.focusTimeString.includes('2.5 hours'));
  });

  // Async Test 6: Simulation Engine generates 5-Day Java Exam Plan (FR-06, PDR Section 12)
  await asyncTest('Simulation engine creates complete 5-day Java study plan', async () => {
    const response = await bedrockService.processAssistantRequest(
      'I have five days to prepare for my Java exam. Help me create a revision plan.',
      []
    );
    assert(response.reply.includes('Java'));
    assert(response.structuredData.plan);
    assert.strictEqual(response.structuredData.plan.days.length, 5);
    assert(response.structuredData.tasks.length >= 5);
  });

  // Async Test 7: Simulation Engine handles "plan my day"
  await asyncTest('Simulation engine creates structured daily plan', async () => {
    const response = await bedrockService.processAssistantRequest('Help me plan my day', []);
    assert(response.structuredData.plan);
    assert(response.structuredData.plan.days[0].items.length > 0);
  });

  // Async Test 8: Simulation Engine handles task prioritization
  await asyncTest('Simulation engine analyzes and prioritizes tasks', async () => {
    const tasks = [
      { id: '1', title: 'Finish Hackathon project', priority: 'High', category: 'Coding', completed: false }
    ];
    const response = await bedrockService.processAssistantRequest('What should I prioritize today?', tasks);
    assert(response.reply.includes('Eisenhower') || response.reply.includes('priority'));
  });

  console.log(`\n====================================================`);
  console.log(`Test Results: ${passed}/${total} passed (${((passed/total)*100).toFixed(0)}%)`);
  console.log(`====================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
