'use strict';

var path = require('path');
var http = require('http');
var express = require('express');

var oas3Tools = require('oas3-tools');
var serverPort = 8080;

var options = {
  routing: {
    controllers: path.join(__dirname, './controllers'),
  },
};

var expressAppConfig = oas3Tools.expressAppConfig(
  path.join(__dirname, '../openapi.json'),
  options
);

var app = expressAppConfig.getApp();

// Intercetta tutti gli errori di oas3-tools (validazione, handler mancante, ecc.)
// e restituisce 200 {} invece di 500 — il mock non ha logica reale
app.use(function(err, req, res, next) {
  console.warn('[mock fallback]', req.method, req.path, '->', err.message || err);
  res.status(200).json({});
});

http.createServer(app).listen(serverPort, function () {
  console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
  console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
});
