# LifePilot AI — Setup & Installation Guide

This guide walks you through setting up and running **LifePilot AI** on your local machine, whether you want to test the application immediately in **Local Demo Mode** or connect live to **Amazon Bedrock**.

---

## 📋 Prerequisites

* **Node.js**: `v18.0.0` or higher (tested on Node v18, v20, and v22).
* **npm**: `v9.0.0` or higher (bundled with Node.js).
* **Web Browser**: Chrome, Edge, Safari, or Firefox (Chrome or Edge recommended for native Web Speech API voice input).
* **AWS Account (Optional)**: Required only if you want to connect live to Amazon Bedrock for the AWS Builder challenge.

---

## ⚡ 3-Minute Quickstart (Zero Configuration)

You can launch and test 100% of LifePilot AI without any AWS credentials. The application includes a built-in deterministic simulation engine that mirrors Amazon Bedrock responses using your actual task data.

```bash
# 1. Clone the repository
git clone https://github.com/nikhil-codes-tech/lifepilot.git
cd lifepilot

# 2. Install dependencies
npm install

# 3. Launch the server
npm start
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ☁️ Connecting to Amazon Bedrock (AWS Builder Mini Challenge)

To enable live inference with Anthropic Claude 3.5 Sonnet on Amazon Bedrock:

### Step 1: Request Model Access in AWS Bedrock Console
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, navigate to **Amazon Bedrock**.
3. In the left navigation sidebar, select **Model access**.
4. Click **Modify model access** (or **Manage model access**).
5. Locate **Anthropic > Claude 3.5 Sonnet** (or **Amazon > Nova Micro / Nova Lite**).
6. Check the box and click **Save changes** / **Submit**.
   *(Access is usually approved within a few seconds to minutes).*

### Step 2: Configure IAM Permissions
Ensure your IAM User, Role, or Temporary Credentials have permissions to invoke models on Bedrock.

Attach the following policy to your IAM identity:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokePermissions",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

### Step 3: Configure Environment Variables
Copy the example configuration file:
```bash
cp .env.example .env
```

Open `.env` in your text editor and configure your AWS credentials:
```env
PORT=3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Optional: If using AWS Academy, Learner Lab, or temporary STS credentials:
# AWS_SESSION_TOKEN=AQoDYXdzEJr1...EXAMPLETOKEN

BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
```

> [!SECURITY NOTE]
> Never commit your real `.env` file to version control. The repository includes `.env` in `.gitignore` by default.

---

## 🔍 Verification & Diagnostics

### 1. Command-Line Connectivity Check
LifePilot AI provides a dedicated CLI health-check tool that verifies your AWS keys, model access, and network latency:

```bash
npm run verify-bedrock
```

**Expected Successful Output:**
```text
====================================================
  🔍 LIFEPILOT AI — AMAZON BEDROCK HEALTH CHECK     
====================================================
Region:    us-east-1
Model ID:  anthropic.claude-3-5-sonnet-20240620-v1:0
Configured:YES (Keys detected)
----------------------------------------------------
⏳ Sending ping test request to Amazon Bedrock...
🎉 SUCCESS: Successfully connected to Amazon Bedrock!
⏱️ Latency: 342 ms
💬 Model Response: "Active"
AWS Builder Mini Challenge integration is LIVE and verified!
====================================================
```

### 2. In-App Diagnostics Window
1. Open the app at [http://localhost:3000](http://localhost:3000).
2. Click the **AI Status Pill** in the top navigation bar or the **Settings ⚙️** icon.
3. Click the **[ Test AWS Connection ]** button.
4. The server will invoke the Bedrock Converse API and display real-time latency and verified response text, updating the status pill to **Amazon Bedrock Connected**.

---

## 🧪 Running Automated Tests

Run the full automated test suite (Unit tests + End-to-End server tests):

```bash
npm test
```

**Expected Output:**
```text
🧪 Starting LifePilot AI Automated Test Suite...

  ✅ PASS: Task validation assigns defaults and formats fields
  ✅ PASS: Task validation throws error when title is empty
  ✅ PASS: Prioritization properly classifies tasks into Eisenhower quadrants
  ✅ PASS: serializeTasksForContext returns formatted context string
  ✅ PASS: extractActionableItems extracts structured tasks and plans from markdown
  ✅ PASS: getPrioritizationReason generates explanation from actual metadata
  ✅ PASS: computeWorkloadMetrics accurately calculates counts and focus time
  ✅ PASS: checkScheduleConflict detects when task duration exceeds available time
  ✅ PASS: getInitialTasks returns standard shared tasks list
  ✅ PASS: Simulation engine creates complete 5-day Java study plan
  ✅ PASS: Simulation engine creates structured daily plan
  ✅ PASS: Simulation engine analyzes and prioritizes tasks

====================================================
Test Results: 12/12 passed (100%)
====================================================

🚀 Launching E2E Server Test on port 3456
Testing GET / (index.html)...
  ✅ Static index.html served successfully
Testing GET /api/status...
  ✅ /api/status online
Testing POST /api/chat with Java Exam prompt...
  ✅ /api/chat generated structured 5-day plan successfully!
Testing POST /api/prioritize...
  ✅ /api/prioritize calculated Eisenhower matrix and recommendation!
Testing POST /api/check-conflict...
  ✅ /api/check-conflict detected conflict successfully: 1h 15m

🎉 ALL END-TO-END TESTS PASSED CLEANLY!
```

---

## 🛠️ Available Scripts

| Command | Purpose |
|---|---|
| `npm start` | Launches the production Express web server on port 3000 |
| `npm run dev` | Launches the server with automatic file watching (`node --watch`) |
| `npm test` | Runs the 12-test unit test suite and 5-test E2E integration suite |
| `npm run verify-bedrock` | Runs the Amazon Bedrock live connectivity and latency checker |

---

## ❓ Troubleshooting

### 1. `AccessDeniedException` when calling Bedrock
* **Cause**: Your IAM user or role does not have `bedrock:InvokeModel` permissions.
* **Fix**: In the AWS IAM Console, attach an inline policy granting `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on `*`.

### 2. `ResourceNotFoundException` on model invocation
* **Cause**: Model access for `anthropic.claude-3-5-sonnet-20240620-v1:0` has not been granted in your configured region.
* **Fix**: Open the Amazon Bedrock console for your region (e.g., `us-east-1`), go to **Model access**, and request access. Alternatively, update `BEDROCK_MODEL_ID` in `.env` to another enabled model (e.g., `amazon.nova-micro-v1:0`).

### 3. Using AWS Academy or Temporary Credentials
* **Cause**: AWS Academy and Learner Lab provide session tokens that expire.
* **Fix**: In `.env`, add your temporary `AWS_SESSION_TOKEN`. The backend automatically detects session tokens and initializes the AWS SDK credentials provider accordingly.

### 4. Port 3000 is already in use
* **Fix**: Either stop the existing process or specify a custom port in `.env`:
  ```env
  PORT=8080
  ```
  Then access the app at `http://localhost:8080`.

### 5. Speech Recognition Not Triggering
* **Cause**: Browser microphone permissions are blocked, or browser does not support Web Speech API.
* **Fix**: Open the app in Google Chrome or Microsoft Edge. Click the lock icon in the address bar and ensure **Microphone** permission is set to **Allow**.
