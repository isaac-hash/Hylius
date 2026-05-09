// Test: send a real Sentry-protocol error event to GlitchTip
const DSN_PUBLIC_KEY = '9cc2d123814f490fb5588f9b0f95d2f0';
const PROJECT_ID = '3';
const GLITCHTIP_HOST = 'http://77.68.50.227:8000'; // Direct, no Caddy for this test

const eventId = 'a'.repeat(32); // 32-char hex event ID
const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'hylius.test',
    exception: {
        values: [{
            type: 'HyliusTestError',
            value: 'This is a test error from the Hylius integration test suite',
            stacktrace: {
                frames: [
                    { filename: '/app/services/glitchtip.service.ts', lineno: 35, function: 'GlitchtipService.install' },
                    { filename: '/app/app/api/marketplace/install/route.ts', lineno: 45, function: 'POST' },
                ]
            }
        }]
    },
    tags: { source: 'hylius-test', env: 'production' },
    extra: { testRun: true, timestamp: Date.now() },
    request: { url: 'https://nondelicate-monty-pseudohemal.ngrok-free.dev/marketplace', method: 'POST' },
};

const sentryHeader = `Sentry sentry_version=7,sentry_key=${DSN_PUBLIC_KEY}`;
const url = `${GLITCHTIP_HOST}/api/${PROJECT_ID}/store/`;

console.log(`Sending test error to: ${url}`);
console.log(`Auth: ${sentryHeader}`);

fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': sentryHeader,
    },
    body: JSON.stringify(payload),
})
.then(async res => {
    const text = await res.text();
    console.log(`\nResponse status: ${res.status}`);
    console.log(`Response body: ${text}`);
    if (res.ok) {
        console.log('\n✅ Test error sent successfully! Check the /errors page in the Hylius dashboard.');
    } else {
        console.log('\n❌ Failed to send test error.');
    }
})
.catch(err => {
    console.error('\n❌ Network error:', err.message);
});
