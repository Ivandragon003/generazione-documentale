const { Module } = require('@nestjs/common');
const { DevController } = require('./dev.controller');

class DevModule {}

Module({
  controllers: [DevController],
})(DevModule);

module.exports = { DevModule };