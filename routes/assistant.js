/**
 * LifePilot AI — Assistant API Routes
 * Endpoints for conversational chat, structured planning,
 * priority analysis, and Amazon Bedrock diagnostics.
 */

const express = require('express');
const router = express.Router();
const bedrockService = require('../services/bedrockService');
const {
  analyzePriorities,
  validateTask,
  computeWorkloadMetrics,
  getPrioritizationReason
} = require('../utils/taskManager');

/**
 * POST /api/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, tasks = [], history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message text is required.'
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
      error: 'An internal error occurred while processing the request.',
      details: error.message
    });
  }
});

/**
 * POST /api/plan
 */
router.post('/plan', async (req, res) => {
  try {
    const { goal, days = 5, hoursPerDay = 3, tasks = [] } = req.body;

    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A goal or subject is required.'
      });
    }

    const prompt = `Create a structured ${days}-day preparation and revision schedule for "${goal.trim()}". Available study time is ${hoursPerDay} hours per day. Break down topics progressively, include practice, and supply specific daily milestones.`;
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
 */
router.post('/prioritize', async (req, res) => {
  try {
    const { tasks = [] } = req.body;
    const validatedTasks = Array.isArray(tasks) ? tasks : [];
    const localAnalysis = analyzePriorities(validatedTasks);

    const prompt = `Review my current task list and provide a concise, direct prioritization summary. Explain which task to do first based on deadlines and importance: ${JSON.stringify(validatedTasks.map(t => ({ title: t.title, priority: t.priority, category: t.category, dueDate: t.dueDate })))}`;

    const result = await bedrockService.processAssistantRequest(prompt, validatedTasks, []);

    return res.json({
      success: true,
      data: {
        analysis: localAnalysis,
        aiRecommendation: result.reply,
        serviceStatus: result.serviceStatus,
        serviceLabel: result.serviceLabel
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
 * POST /api/metrics
 */
router.post('/metrics', (req, res) => {
  const { tasks = [] } = req.body;
  const metrics = computeWorkloadMetrics(Array.isArray(tasks) ? tasks : []);
  return res.json({
    success: true,
    data: metrics
  });
});

/**
 * GET /api/status
 * Truthful status system:
 * - 'connected': Amazon Bedrock Connected
 * - 'demo': Demo Mode · Sample Responses
 * - 'offline': AI Offline · Retry
 */
router.get('/status', (req, res) => {
  const isConfig = bedrockService.isConfigured();
  const isVerified = bedrockService.hasVerifiedConnection();

  let statusKey = 'demo';
  let statusLabel = 'Demo Mode · Sample Responses';

  if (isVerified) {
    statusKey = 'connected';
    statusLabel = 'Amazon Bedrock Connected';
  } else if (isConfig) {
    // Configured in .env, awaiting verification
    statusKey = 'demo';
    statusLabel = 'Demo Mode · Sample Responses';
  }

  return res.json({
    status: 'online',
    appName: 'LifePilot',
    tagline: 'Make space for what matters.',
    aiStatus: statusKey,
    aiStatusLabel: statusLabel,
    awsBedrock: {
      configured: isConfig,
      verified: isVerified,
      region: bedrockService.AWS_REGION,
      modelId: bedrockService.MODEL_ID
    },
    uptime: Math.floor(process.uptime())
  });
});

/**
 * POST /api/test-bedrock
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
      error: error.message,
      data: {
        connected: false,
        statusLabel: 'AI Offline · Retry'
      }
    });
  }
});

module.exports = router;
