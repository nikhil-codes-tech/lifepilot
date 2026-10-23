/**
 * LifePilot AI — End-to-End Server & HTTP Verification
 * Spawns server, tests all REST endpoints and static file delivery.
 */

const http = require('http');
const app = require('../server');

const TEST_PORT = 3456;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw), raw });
          } catch {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runE2E() {
  console.log('🚀 Launching E2E Server Test on port', TEST_PORT);
  server = app.listen(TEST_PORT, async () => {
    try {
      // 1. Test Static files
      console.log('Testing GET / (index.html)...');
      const indexRes = await request('GET', '/');
      if (indexRes.status === 200 && indexRes.raw.includes('LifePilot')) {
        console.log('  ✅ Static index.html served successfully');
      } else {
        throw new Error(`Failed to serve index.html: status ${indexRes.status}`);
      }

      // 2. Test /api/status
      console.log('Testing GET /api/status...');
      const statusRes = await request('GET', '/api/status');
      if (statusRes.status === 200 && statusRes.data.status === 'online') {
        console.log('  ✅ /api/status online:', statusRes.data.awsBedrock);
      } else {
        throw new Error(`/api/status check failed: ${JSON.stringify(statusRes)}`);
      }

      // 3. Test /api/chat with Java exam prompt (Use Case from PDR)
      console.log('Testing POST /api/chat with Java Exam prompt...');
      const chatRes = await request('POST', '/api/chat', {
        message: 'I have five days to prepare for my Java exam. Help me create a revision plan.',
        tasks: []
      });
      if (chatRes.status === 200 && chatRes.data.success && chatRes.data.data.structuredData.plan) {
        console.log('  ✅ /api/chat generated structured 5-day plan successfully!');
        console.log('     Plan Title:', chatRes.data.data.structuredData.plan.title);
        console.log('     Days count:', chatRes.data.data.structuredData.plan.days.length);
      } else {
        throw new Error(`/api/chat test failed: ${JSON.stringify(chatRes)}`);
      }

      // 4. Test /api/prioritize
      console.log('Testing POST /api/prioritize...');
      const prioRes = await request('POST', '/api/prioritize', {
        tasks: [
          { id: '1', title: 'Submit Hackathon project', priority: 'High', category: 'Coding', dueDate: '2026-10-24' }
        ]
      });
      if (prioRes.status === 200 && prioRes.data.success) {
        console.log('  ✅ /api/prioritize calculated Eisenhower matrix and recommendation!');
      } else {
        throw new Error(`/api/prioritize test failed: ${JSON.stringify(prioRes)}`);
      }

      // 5. Test POST /api/check-conflict
      console.log('Testing POST /api/check-conflict...');
      const conflictRes = await request('POST', '/api/check-conflict', {
        totalMinutes: 255,
        availableHours: 3
      });
      if (conflictRes.status === 200 && conflictRes.data.success && conflictRes.data.data.hasConflict) {
        console.log('  ✅ /api/check-conflict detected conflict successfully:', conflictRes.data.data.diffString);
      } else {
        throw new Error(`/api/check-conflict test failed: ${JSON.stringify(conflictRes)}`);
      }

      console.log('\n🎉 ALL END-TO-END TESTS PASSED CLEANLY!\n');
      process.exit(0);
    } catch (err) {
      console.error('❌ E2E Test Failure:', err);
      process.exit(1);
    } finally {
      if (server) server.close();
    }
  });
}

runE2E();
