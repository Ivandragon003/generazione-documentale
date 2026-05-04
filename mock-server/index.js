'use strict';

var path = require('path');
var http = require('http');

var oas3Tools = require('oas3-tools');
var serverPort = 8080;

var options = {
  routing: {
    controllers: path.join(__dirname, './controllers'),
  },
  openApiValidator: {
    validateRequests:  false,  // non bloccare richieste malformate
    validateResponses: false,  // non bloccare risposte vuote
  },
};

var expressAppConfig = oas3Tools.expressAppConfig(
  path.join(__dirname, '../openapi.json'),
  options
);

var app = expressAppConfig.getApp();

http.createServer(app).listen(serverPort, function () {
  console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
  console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
});
