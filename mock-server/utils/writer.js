'use strict';

var ResponsePayload = function(code, payload) {
  this.code = code;
  this.payload = payload;
};

exports.respondWithCode = function(code, payload) {
  return new ResponsePayload(code, payload);
};

var writeJson = exports.writeJson = function(response, arg1, arg2) {
  var code;
  var payload;

  if (arg1 && arg1 instanceof ResponsePayload) {
    writeJson(response, arg1.payload, arg1.code);
    return;
  }

  if (arg2 && Number.isInteger(arg2)) {
    code = arg2;
  } else if (arg1 && Number.isInteger(arg1)) {
    code = arg1;
  }

  if (!code) {
    code = 200;
  }

  // Se il service non restituisce nulla (undefined/null), rispondi con oggetto vuoto
  if (arg1 === undefined || arg1 === null || Number.isInteger(arg1)) {
    payload = '{}';
  } else if (typeof arg1 === 'object') {
    payload = JSON.stringify(arg1, null, 2);
  } else {
    payload = arg1;
  }

  response.writeHead(code, { 'Content-Type': 'application/json' });
  response.end(payload);
};
