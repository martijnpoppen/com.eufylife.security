"use strict";

const util = require('util');
const winston = require('winston');


function transform(info, opts) {
  const args = info[Symbol.for('splat')];
  if (args) { info.message = util.format(info.message, ...args); }
  return info;
}

function utilFormatter() { return {transform}; }

const papertrail = new winston.transports.Http({
    host: 'logs.collector.solarwinds.com',
    path: '/v1/log',
    auth: { username: new String(''), password: 'reFOVoRU1YuC-tRI5zjIuuFhYkUK' },
    ssl: true,
  });

exports.log = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
      utilFormatter(),     // <-- this is what changed
      winston.format.printf(({level, message, label, timestamp}) => `${timestamp} ${label || '-'} ${message}`),
    ),
    transports: [
      papertrail
    ],
});