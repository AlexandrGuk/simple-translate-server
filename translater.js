const http = require('http');
const fetch = require('node-fetch');

http.createServer(async (request, response) => {
    console.log("request start update");
    const translateUrl = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=ru";
    let translatedArray = [];
    const msTranslateBody = {
        body: "[{'Text':'Hello, what is your name?'}]",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Ocp-Apim-Subscription-Key": "7fda0040c26140768975d7ca6dcbbfcd"
        },
        method: "POST"
    };
    let translatedObject = await fetch(translateUrl, msTranslateBody).then(response => response.json());
    console.log(translatedObject);
    if ( translatedObject.error ) {
        response.statusCode = 400;
        response.end(translatedObject.error.message);
    }
    if ( Array.isArray(translatedObject) && translatedObject[0] && translatedObject[0].translations ) {
        translatedArray = translatedObject[0].translations.map(translate => translate.text);
        response.end(JSON.stringify(translatedArray));
    }
    response.statusCode = 404;
    response.end("404");
}).listen(3000, "localhost", () => console.log("started server"));