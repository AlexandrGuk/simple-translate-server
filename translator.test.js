const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./translator');

function listen(server) {
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

async function withServer(options, run) {
    const server = createServer(options);
    const port = await listen(server);
    try {
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await close(server);
    }
}

test('health returns ok', async () => {
    await withServer({}, async (base) => {
        const response = await fetch(`${base}/health`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
    });
});

test('rejects empty text', async () => {
    await withServer({}, async (base) => {
        const response = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '   ' }),
        });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'empty' });
    });
});

test('returns translation from the provider', async () => {
    await withServer({
        translate: async () => ({ translation: 'Привет', detected: 'en' }),
    }, async (base) => {
        const response = await fetch(`${base}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'hello',
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { translation: 'Привет', detected: 'en' });
    });
});

test('requires token when configured', async () => {
    await withServer({
        token: 'secret',
        translate: async () => ({ translation: 'Привет', detected: 'en' }),
    }, async (base) => {
        const denied = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'hello',
        });
        assert.equal(denied.status, 401);

        const allowed = await fetch(base, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'X-Translate-Token': 'secret',
            },
            body: 'hello',
        });
        assert.equal(allowed.status, 200);
    });
});

test('translates through Google', async () => {
    await withServer({}, async (base) => {
        const response = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'hello world', target: 'ru' }),
        });
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.detected, 'en');
        assert.match(data.translation, /привет/i);
    });
});
