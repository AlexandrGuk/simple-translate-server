const { execFile } = require('child_process');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.TRANSLATE_TOKEN || '';
const MAX_TEXT = 5000;
const TIMEOUT_MS = 8000;

function normalizeTarget(target) {
    return /^[a-z]{2}(-[a-z]{2})?$/i.test(target) ? target.toLowerCase() : 'ru';
}

// Google rejects Node's TLS fingerprint, so the request goes out through curl.
function translateGoogle(text, target) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', target);
    url.searchParams.set('dt', 't');
    url.searchParams.set('dj', '1');
    url.searchParams.set('q', text);

    return new Promise((resolve) => {
        execFile('curl', [
            '-sS',
            '--max-time', String(Math.ceil(TIMEOUT_MS / 1000)),
            '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            '-H', 'Accept: */*',
            '-w', '\n%{http_code}',
            url.toString(),
        ], { timeout: TIMEOUT_MS + 1000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(null);
                return;
            }
            const lines = stdout.replace(/\s+$/, '').split('\n');
            const status = Number(lines.pop());
            if (status !== 200) {
                resolve(null);
                return;
            }
            try {
                const data = JSON.parse(lines.join('\n'));
                const sentences = Array.isArray(data.sentences) ? data.sentences : [];
                const translation = sentences.map((sentence) => sentence.trans || '').join('');
                resolve(translation ? { translation, detected: data.src || '' } : null);
            } catch {
                resolve(null);
            }
        });
    });
}

function readText(body) {
    if (typeof body === 'string') {
        return { text: body, target: 'ru' };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { text: '', target: 'ru' };
    }
    return {
        text: typeof body.text === 'string' ? body.text : '',
        target: typeof body.target === 'string' ? body.target : 'ru',
    };
}

async function createServer(options = {}) {
    const translate = options.translate || translateGoogle;
    const translatePremium = options.translatePremium || translate;
    const token = options.token !== undefined ? options.token : TOKEN;
    const app = Fastify({
        logger: options.logger ?? false,
        bodyLimit: 32 * 1024,
        trustProxy: 1,
    });

    app.addContentTypeParser('text/plain', { parseAs: 'string' }, (request, body, done) => {
        done(null, body);
    });

    app.setErrorHandler((error, request, reply) => {
        const status = error.statusCode || 500;
        if (status === 400) {
            reply.code(400).send({ error: 'invalid_json' });
            return;
        }
        if (status === 401) {
            reply.code(401).send({ error: 'unauthorized' });
            return;
        }
        if (status === 413) {
            reply.code(413).send({ error: 'too_large' });
            return;
        }
        if (status === 415) {
            reply.code(415).send({ error: 'unsupported_type' });
            return;
        }
        if (status === 429) {
            reply.code(429).send({ error: 'rate_limited' });
            return;
        }
        reply.code(status).send({ error: 'error' });
    });

    await app.register(cors, {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Translate-Token'],
    });

    if (options.rateLimit !== false) {
        await app.register(rateLimit, {
            max: 60,
            timeWindow: '1 minute',
        });
    }

    app.addHook('onRequest', async (request) => {
        if (!token || request.method === 'OPTIONS') {
            return;
        }
        const path = request.url.split('?')[0];
        if (path === '/health') {
            return;
        }
        if (request.headers['x-translate-token'] !== token) {
            const error = new Error('unauthorized');
            error.statusCode = 401;
            throw error;
        }
    });

    app.get('/health', async () => ({ ok: true }));

    function makeRoute(engine, providerName) {
        return async function translateRoute(request, reply) {
            const parsed = readText(request.body);
            const text = parsed.text.trim();
            if (!text) {
                reply.code(400).send({ error: 'empty' });
                return;
            }
            if (text.length > MAX_TEXT) {
                reply.code(413).send({ error: 'too_large' });
                return;
            }
            const result = await engine(text, normalizeTarget(parsed.target));
            if (!result || !result.translation) {
                reply.code(502).send({ error: 'translate_failed' });
                return;
            }
            return providerName ? { ...result, provider: providerName } : result;
        };
    }

    app.post('/', makeRoute(translate));
    app.post('/translate', makeRoute(translate));
    app.post('/premium', makeRoute(translatePremium, 'premium'));

    return app;
}

if (require.main === module) {
    createServer({ logger: true })
        .then((app) => app.listen({ port: PORT, host: HOST }))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { createServer, translateGoogle };
