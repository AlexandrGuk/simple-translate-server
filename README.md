# simple-translate-server

HTTP-прокси к Google Translate для расширения Simple Translator.

`POST /` или `POST /translate` с телом `{"text":"hello","target":"ru"}` либо сырым текстом. Ответ: `{"translation":"...","detected":"en"}`.

`GET /health` отвечает `{"ok":true}`.

Нужны Node.js 18+ и `curl`. Запрос к Google идёт через `curl`: Google отклоняет TLS-отпечаток Node.js. Запуск: `npm start`. Порт задаётся `PORT` (по умолчанию 5000). Если задан `TRANSLATE_TOKEN`, запрос должен содержать заголовок `X-Translate-Token`.

Юнит systemd: `deploy/simple-translate.service`.
