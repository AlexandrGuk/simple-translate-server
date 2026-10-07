const http = require('http');
const { execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.TRANSLATE_TOKEN || '';
const MAX_TEXT = 5000;
const TIMEOUT_MS = 8000;

function send(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Translate-Token',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_TEXT * 8) {
                const error = new Error('too_large');
                error.status = 413;
                reject(error);
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function parseRequest(raw, contentType) {
    if ((contentType || '').includes('application/json')) {
        const data = JSON.parse(raw || '{}');
        return {
            text: typeof data.text === 'string' ? data.text : '',
            target: typeof data.target === 'string' ? data.target : 'ru',
        };
    }
    return { text: raw, target: 'ru' };
}

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

function createServer(options = {}) {
    const translate = options.translate || translateGoogle;
    const token = options.token !== undefined ? options.token : TOKEN;

    return http.createServer(async (req, res) => {
        try {
            const path = (req.url || '/').split('?')[0];
            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Translate-Token',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                });
                res.end();
                return;
            }
            if (req.method === 'GET' && path === '/health') {
                send(res, 200, { ok: true });
                return;
            }
            if (req.method !== 'POST' || (path !== '/' && path !== '/translate')) {
                send(res, 405, { error: 'method_not_allowed' });
                return;
            }
            if (token && req.headers['x-translate-token'] !== token) {
                send(res, 401, { error: 'unauthorized' });
                return;
            }

            const raw = await readBody(req);
            let parsed;
            try {
                parsed = parseRequest(raw, req.headers['content-type']);
            } catch {
                send(res, 400, { error: 'invalid_json' });
                return;
            }

            const text = parsed.text.trim();
            if (!text) {
                send(res, 400, { error: 'empty' });
                return;
            }
            if (text.length > MAX_TEXT) {
                send(res, 413, { error: 'too_large' });
                return;
            }

            const result = await translate(text, normalizeTarget(parsed.target));
            if (!result || !result.translation) {
                send(res, 502, { error: 'translate_failed' });
                return;
            }
            send(res, 200, result);
        } catch (error) {
            if (res.headersSent || res.writableEnded) {
                return;
            }
            send(res, error.status || 500, { error: error.status ? error.message : 'error' });
        }
    });
}

if (require.main === module) {
    createServer().listen(PORT, HOST, () => {
        console.log(`listening on ${HOST}:${PORT}`);
    });
}

module.exports = { createServer, translateGoogle };
