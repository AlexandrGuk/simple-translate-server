const http = require('http');
const fetch = require('node-fetch');

http.createServer(async (request, response) => {
    let body = [];
    request.on('error', (err) => {
    }).on('data', (chunk) => {
        body.push(chunk);
    }).on('end', async () => {
        body = Buffer.concat(body).toString();
        let translatedArray = await getTranslateFromGoogle(body);
        if ( translatedArray ) {
            console.log("from google");
            console.log(JSON.stringify(translatedArray));
            response.end(JSON.stringify(translatedArray.join(" ")));
            return;
        }
        translatedArray = await getTranslateFromBing(body);
        if ( translatedArray ) {
            console.log("from bing");
            console.log(JSON.stringify(translatedArray));
            response.end(JSON.stringify(translatedArray.join(" ")));
            return;
        }
    });
}).listen(3000, "localhost", () => console.log("started server"));

async function getTranslateFromGoogle(text) {
    const encodedText = encodeURIComponent(text);
    const reqUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&hl=ru&dt=t&dt=bd&dj=1&source=input&q=${encodedText}`;
    const response = await fetch(reqUrl).then(resp => resp.ok ? resp.json() : null).catch(e => null);
    if ( !response ) {
        return null;
    }
    return response.sentences.map(sentence => sentence.trans);
}

async function getTranslateFromBing(text) {
    const encodedText = encodeURIComponent(text);
    const reqUrl = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=ru";
    let translatedArray = [];
    const msTranslateBody = {
        body: `[{'Text':'${encodedText}'}]`,
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Ocp-Apim-Subscription-Key": "7fda0040c26140768975d7ca6dcbbfcd"
        },
        method: "POST"
    };
    let translatedObject = await fetch(reqUrl, msTranslateBody).then(response => response.ok ? response.json() : null).catch(e => null);
    if ( translatedObject.error ) {
        return null;
    }
    if ( Array.isArray(translatedObject) && translatedObject[0] && translatedObject[0].translations ) {
        translatedArray = translatedObject[0].translations.map(translate => translate.text);
        return translatedArray;
    }
}