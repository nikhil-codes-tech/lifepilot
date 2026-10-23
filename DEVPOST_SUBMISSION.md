# LifePilot AI — Devpost Hackathon Submission Form

**Event:** Build, Ship, Shape: Amazon Developer Hackathon 2026  
**Primary Track:** Alexa+ (Simulated Experience)  
**Mini Challenge:** AWS Builder  
**Project Name:** LifePilot AI — Your Personal AI Assistant  
**Tagline:** A simulated Alexa+ conversational assistant powered by Amazon Bedrock that transforms everyday natural language goals into structured daily schedules and prioritized task boards.

---

## 📌 Project Overview

### Inspiration
Students, developers, and working professionals juggle dozens of competing responsibilities every day. Traditional productivity apps and to-do lists are notoriously manual: you spend cognitive energy typing tasks, estimating durations, and reorganizing schedules. When plans change or an unexpected exam looms, manual restructuring becomes tedious and overwhelming.

With the advent of **Alexa+**, conversational AI can transcend simple timers and basic question-answering. We envisioned **LifePilot AI**: a proactive, voice-first copilot that doesn't just listen to your goals, but actually constructs structured, time-blocked itineraries, sorts your tasks using the Eisenhower Decision Matrix, and transfers AI-generated milestones straight into an interactive Kanban board with a single tap.

---

### What It Does
LifePilot AI bridges conversational intelligence and actionable task management through a simulated Alexa+ web interface:

1. **Conversational Productivity Assistant (Alexa+ Simulation)**:
   - Users can talk using real-time voice input (Web Speech API) or type natural-language requests such as *"I have five days to prepare for my Java exam. Help me create a revision plan"*, *"Help me plan my day"*, or *"What should I prioritize today?"*.
   - Features the iconic **Alexa Glowing Ambient Ring** with real-time acoustic visual feedback (idle, listening, thinking, speaking) and synthetic two-tone Alexa chimes.
   - Text-to-speech engine speaks responses back in a natural assistant voice.

2. **Multi-Day & Daily Plan Generator**:
   - Generates structured day-by-day itineraries with specific time slots, themes, categories, and durations.
   - Includes **"➕ Add to Tasks"** and **"➕ Add All to Tasks"** buttons to turn AI suggestions directly into actionable task cards.

3. **Smart Task Board & Eisenhower Matrix**:
   - Manages tasks across High, Medium, and Low priorities and diverse categories (Study, Work, Coding, Health, Personal).
   - Dynamic Eisenhower Matrix groups tasks into:
     - **Q1 (Do First)**: Urgent & Important
     - **Q2 (Schedule)**: Important, Not Urgent
     - **Q3 (Quick Wins)**: Urgent, Not Important
     - **Q4 (Minimize)**: Low Urgency & Importance
   - Persists all state locally in the browser.

4. **Amazon Bedrock Foundation Model Integration**:
   - Server-side invocation of Anthropic Claude 3.5 Sonnet / Amazon Nova through the AWS SDK Converse API.
   - Includes a zero-config, intelligent **Local Simulation Mode** so reviewers can test every feature instantly even without active AWS cloud keys.

---

### How We Built It
- **Presentation Layer**: Built using HTML5, modern CSS3 with custom Alexa+ dark/light glassmorphic themes, and modular vanilla JavaScript.
- **Audio & Voice**: Web Speech API for real-time speech recognition (STT) and voice synthesis (TTS); Web Audio API oscillator synthesis for Alexa wake and accomplishment chimes.
- **Backend Application Layer**: Node.js and Express.js providing REST endpoints (`/api/chat`, `/api/plan`, `/api/prioritize`, `/api/status`, `/api/test-bedrock`).
- **AI Layer**: Amazon Bedrock via `@aws-sdk/client-bedrock-runtime` using the unified `ConverseCommand` API.
- **Task Management Engine**: Context serialization utility in `taskManager.js` that converts current user task states into structured LLM prompts and parses JSON plan blocks from AI responses.
- **Testing & Verification**: 100% automated test coverage with native Node.js assertions and E2E HTTP server test suites (`npm test`).

---

### Challenges We Ran Into
1. **Bridging Conversational Dialogue with Structured UI Actions**:
   LLMs naturally produce flowing conversational text, but our task board and timeline required structured JSON objects (time blocks, categories, priority ratings). We engineered a dual-output prompting strategy where the model provides friendly spoken dialogue alongside a structured JSON block, which the backend strips before narration while parsing for the interactive timeline.
2. **Robust Fallback & Reviewer Accessibility**:
   Hackathon judges might not have immediate AWS credentials or access to specific Bedrock model IDs in their local environment. We created an intelligent, contextual Local Simulation Engine that accurately mirrors Bedrock's outputs for study plans, daily schedules, and priority analyses while transparently labeling the engine status.
3. **Voice & Ambient Synchronization**:
   Synchronizing the Alexa glowing ring animations across speech recognition listening, backend thinking, and speech synthesis speaking states required precise lifecycle event handling with the browser's Web Speech and Web Audio APIs.

---

### Accomplishments That We're Proud Of
- **True Alexa+ Experience**: Achieving a genuine voice-first assistant feel right in the browser, complete with acoustic cues, glowing reactive ring animations, and speech narration.
- **Zero-Dependency Sound Generation**: Using Web Audio API to synthesize harmonic sine-wave chimes dynamically in code without loading external MP3/WAV audio files.
- **Flawless AWS Bedrock Integration**: Cleanly implementing the modern AWS SDK v3 Bedrock Converse API with comprehensive diagnostic testing (`npm run verify-bedrock`).
- **100% Test Coverage**: Passing all 8 automated unit/integration tests and end-to-end HTTP tests.

---

### What We Learned
- How to leverage the AWS Bedrock Converse API to create consistent multi-turn assistant conversations with unified inference configuration across multiple foundation models.
- Techniques for prompt conditioning that reliably yield both conversational prose and machine-readable data structures.
- Practical UI patterns for integrating speech-to-text and text-to-speech seamlessly into web productivity tools.

---

### What's Next for LifePilot AI
- **Official Alexa+ Agent Skill / MCP Server**: Extending the web simulation into a production Model Context Protocol (MCP) server for native Alexa+ devices.
- **Calendar Integrations**: Direct two-way synchronization with Google Calendar and Outlook via OAuth.
- **Multi-Device Cloud Sync**: Backing task storage with Amazon DynamoDB and AWS Cognito for cross-device authentication.
- **Proactive Notifications**: Amazon SNS/SES alerts for upcoming scheduled study milestones and break reminders.

---

## ☁️ AWS Builder Mini Challenge Write-Up

### 1. Which AWS service was used?
**Amazon Bedrock** (specifically the Bedrock Runtime Service using `@aws-sdk/client-bedrock-runtime`).

### 2. What does the service do in LifePilot AI?
Amazon Bedrock serves as the cognitive intelligence engine of LifePilot AI. It receives the user's conversational requests alongside the current snapshot of active tasks, analyzes deadlines, goals, and constraints, and generates:
- Spaced-repetition study revision schedules (e.g., 5-day Java exam preparation).
- Time-blocked daily productivity itineraries.
- Strategic task prioritization using the Eisenhower Decision Matrix.
- Actionable task items with categories and time estimates.

### 3. Where does the integration appear in the source code?
- **[services/bedrockService.js](services/bedrockService.js)**: Initializes `BedrockRuntimeClient`, prepares system prompts and multi-turn message history, dispatches `ConverseCommand` to Claude 3.5 Sonnet / Amazon Nova, tracks token usage and roundtrip latency, and implements graceful local fallback.
- **[routes/assistant.js](routes/assistant.js)**: Exposes REST API endpoints (`/api/chat`, `/api/plan`, `/api/prioritize`, `/api/test-bedrock`) consumed by the frontend.
- **[test/verifyBedrock.js](test/verifyBedrock.js)**: Standalone command-line verification utility for validating AWS credentials, IAM permissions, and model availability.

### 4. How to configure the service?
1. Open `.env` and set:
   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
   ```
2. Verify connectivity by running:
   ```bash
   npm run verify-bedrock
   ```

### 5. How to reproduce a successful request?
- In the web app: Click the status badge in the top navbar and click **"Test Amazon Bedrock Handshake"**.
- Or via terminal:
  ```bash
  npm run verify-bedrock
  ```
- Or make a POST request:
  ```bash
  curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\":\"I have five days to prepare for my Java exam. Help me create a revision plan.\"}"
  ```

### 6. What worked well and what needs improvement?
- **What worked well**: The AWS Bedrock Converse API is exceptionally uniform. Switching between Claude 3.5 Sonnet and Amazon Nova required only changing the `modelId` string without rewriting payload formatting code. Response latency was remarkably fast for structured outputs.
- **What needs improvement**: Model Access onboarding in the AWS Console can occasionally take time for new AWS accounts. Providing our transparent local simulation fallback ensured zero downtime for hackathon testers.

---

## 🏷️ Built With
- `amazon-bedrock`
- `aws-sdk-v3`
- `claude-3.5-sonnet`
- `alexa-plus`
- `node.js`
- `express`
- `javascript`
- `html5`
- `css3`
- `web-speech-api`
- `web-audio-api`
