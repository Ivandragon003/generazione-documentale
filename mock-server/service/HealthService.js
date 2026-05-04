'use strict';

exports.healthController_check = function() {
  return new Promise(function(resolve) {
    resolve({ status: 'ok', timestamp: new Date().toISOString() });
  });
};
