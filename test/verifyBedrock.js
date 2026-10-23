/**
 * LifePilot AI — Amazon Bedrock Connectivity Verifier
 * Run via: npm run verify-bedrock
 * Checks environment variables, IAM credentials, model availability, and latency.
 */

require('dotenv').config();
const { testBedrockConnection, isConfigured, AWS_REGION, MODEL_ID } = require('../services/bedrockService');

async function verify() {
  console.log('====================================================');
  console.log('  🔍 LIFEPILOT AI — AMAZON BEDROCK HEALTH CHECK     ');
  console.log('====================================================');
  console.log(`Region:    ${AWS_REGION}`);
  console.log(`Model ID:  ${MODEL_ID}`);
  console.log(`Configured:${isConfigured() ? 'YES (Keys detected)' : 'NO (Missing keys in .env)'}`);
  console.log('----------------------------------------------------');

  if (!isConfigured()) {
    console.log('⚠️  Notice: AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing or set to placeholder.');
    console.log('    LifePilot AI will run automatically in Local Simulation Mode.');
    console.log('    To connect live to Amazon Bedrock:');
    console.log('    1. Open .env file');
    console.log('    2. Set your AWS credentials:');
    console.log('       AWS_ACCESS_KEY_ID=AKIA...');
    console.log('       AWS_SECRET_ACCESS_KEY=...');
    console.log('       AWS_REGION=us-east-1');
    console.log('    3. Ensure model access is enabled in the AWS Bedrock Console.');
    console.log('====================================================\n');
    return;
  }

  console.log('⏳ Sending ping test request to Amazon Bedrock...');
  const result = await testBedrockConnection();

  if (result.connected) {
    console.log('🎉 SUCCESS: Successfully connected to Amazon Bedrock!');
    console.log(`⏱️ Latency: ${result.latencyMs} ms`);
    console.log(`💬 Model Response: "${result.reply.trim()}"`);
    console.log('AWS Builder Mini Challenge integration is LIVE and verified!');
  } else {
    console.log('❌ FAILED: Could not complete handshake with Amazon Bedrock.');
    console.log(`Error Code: ${result.code || 'UNKNOWN'}`);
    console.log(`Message:    ${result.error}`);
    console.log('\nTroubleshooting tips:');
    console.log('- Ensure your IAM user/role has "bedrock:InvokeModel" permission.');
    console.log(`- Verify that "${MODEL_ID}" is granted access in the AWS Bedrock Console under Model Access.`);
    console.log('- Check that the AWS_REGION matches the region where you enabled model access.');
  }
  console.log('====================================================\n');
}

verify();
