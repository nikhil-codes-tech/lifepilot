/**
 * LifePilot AI — Assistant API Routes
 * Endpoints for conversational chat, structured planning,
 * priority analysis, and Amazon Bedrock diagnostics.
 */

const express = require('express');
const router = express.Router();
const bedrockService = require('../services/bedrockService');
const { analyzePriorities, validateTask } = require('../utils/taskManager');

/**
 * POST /api/chat
 * Primary conversational interface endpoint.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, tasks = [], history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message text is required and cannot be empty.'
      });
    }

    const result = await bedrockService.processAssistantRequest(
      message.trim(),
      Array.isArray(tasks) ? tasks : [],
      Array.isArray(history) ? history : []
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while processing your request.',
      details: error.message
    });
  }
});

/**
 * POST /api/plan
 * Structured planning endpoint for study or daily schedules.
 */
router.post('/plan', async (req, res) => {
  try {
    const { goal, days = 5, hoursPerDay = 4, tasks = [] } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A goal or subject is required (e.g., "Java exam", "Sprint planning").'
      });
    }

    const prompt = `Create a structured ${days}-day preparation and revision schedule for "${goal.trim()}". Available study time is approximately ${hoursPerDay} hours per day. Break down topics progressively, include practice, and supply specific daily milestones.`;
    
    const result = await bedrockService.processAssistantRequest(prompt, tasks, []);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in /api/plan:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate plan.',
      details: error.message
    });
  }
});

/**
 * POST /api/prioritize
 * Returns Eisenhower Matrix analysis and Bedrock prioritization recommendations.
 */
router.post('/prioritize', async (req, res) => {
  try {
    const { tasks = [] } = req.body;
    const validatedTasks = Array.isArray(tasks) ? tasks : [];
    const localAnalysis = analyzePriorities(validatedTasks);

    const prompt = `Review my current task list and provide a strategic prioritization summary. Tell me what to tackle first, what to schedule, and what to watch out for: ${JSON.stringify(validatedTasks.map(t => ({ title: t.title, priority: t.priority, category: t.category, dueDate: t.dueDate })))}`;

    const result = await bedrockService.processAssistantRequest(prompt, validatedTasks, []);

    return res.json({
      success: true,
      data: {
        analysis: localAnalysis,
        aiRecommendation: result.reply,
        isSimulated: result.isSimulated,
        service: result.service
      }
    });
  } catch (error) {
    console.error('Error in /api/prioritize:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to prioritize tasks.',
      details: error.message
    });
  }
});

/**
 * GET /api/status
 * System health and AWS Bedrock configuration status.
 */
router.get('/status', (req, res) => {
  const configured = bedrockService.isConfigured();
  return res.json({
    status: 'online',
    appName: 'LifePilot AI',
    version: '1.0.0',
    awsBedrock: {
      configured,
      region: bedrockService.AWS_REGION,
      modelId: bedrockService.MODEL_ID,
      mode: configured ? 'Amazon Bedrock (Live)' : 'Simulation Mode (Local)'
    },
    uptime: Math.floor(process.uptime())
  });
});

/**
 * POST /api/test-bedrock
 * Diagnostics endpoint to test Amazon Bedrock connectivity.
 */
router.post('/test-bedrock', async (req, res) => {
  try {
    const result = await bedrockService.testBedrockConnection();
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
