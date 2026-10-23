/**
 * LifePilot AI — Application Server
 * Express.js backend serving REST endpoints and the simulated Alexa+ web interface.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const assistantRoutes = require('./routes/assistant');
const bedrockService = require('./services/bedrockService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', assistantRoutes);

// Fallback route for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.',
    message: err.message
  });
});

// Start Server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    const isBedrock = bedrockService.isConfigured();
    console.log('====================================================');
    console.log('           🚀 LIFEPILOT AI SERVER STARTED           ');
    console.log('   Alexa+ Inspired Personal Productivity Copilot   ');
    console.log('====================================================');
    console.log(`📡 URL:             http://localhost:${PORT}`);
    console.log(`🤖 AI Engine:       ${isBedrock ? 'Amazon Bedrock (Live AWS)' : 'Local Simulation Mode (Interactive Demo)'}`);
    console.log(`🌍 AWS Region:      ${bedrockService.AWS_REGION}`);
    console.log(`🧠 Bedrock Model:   ${bedrockService.MODEL_ID}`);
    console.log('====================================================');
  });
}

module.exports = app;
