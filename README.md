# simple-translate-server

HTTP-прокси к Google Translate для расширения Simple Translator.

`POST /` или `POST /translate` с телом `{"text":"hello","target":"ru"}` либо сырым текстом. Ответ: `{"translation":"...","detected":"en"}`.

`GET /health` отвечает `{"ok":true}`.

Нужны Node.js 24 (активная LTS) и `curl`. HTTP-сервер — Fastify. Запрос к Google идёт через `curl`: Google отклоняет TLS-отпечаток Node.js. Запуск: `npm start`. Порт задаётся `PORT` (по умолчанию 5000). Если задан `TRANSLATE_TOKEN`, запрос должен содержать заголовок `X-Translate-Token`. С одного IP допускается 60 запросов в минуту.

`POST /premium` — канал для расширения «Премиум». Сейчас он вызывает тот же перевод, что и обычный маршрут; сюда позже подключается ИИ. Снаружи это `https://alxgk.site/translate/premium`.

Образ: `docker build -t simple-translate .` из `Dockerfile` (`node:24-bookworm-slim`). На VPS Traefik отдаёт его как `https://alxgk.site/translate`.
