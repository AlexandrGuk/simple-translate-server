const http = require('http');
const fetch = require('node-fetch');

http.createServer(async (request, response) => {
    let body = [];
    request.on('error', (err) => {
    }).on('data', (chunk) => {
        body.push(chunk);
    }).on('end', async () => {
        body = Buffer.concat(body).toString();
        const translateUrl = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=ru";
        let translatedArray = [];
        const msTranslateBody = {
            body: `[{'Text':'${body}'}]`,
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "Ocp-Apim-Subscription-Key": "7fda0040c26140768975d7ca6dcbbfcd"
            },
            method: "POST"
        };
        let translatedObject = await fetch(translateUrl, msTranslateBody).then(response => response.json());
        if ( translatedObject.error ) {
            response.statusCode = 400;
            response.end(translatedObject.error.message);
        }
        if ( Array.isArray(translatedObject) && translatedObject[0] && translatedObject[0].translations ) {
            translatedArray = translatedObject[0].translations.map(translate => translate.text);
            console.warn(translatedArray);
            response.end(JSON.stringify(translatedArray));
        }
    });

    //response.statusCode = 404;
   // response.end("ERROR");
}).listen(3000, "localhost", () => console.log("started server"));