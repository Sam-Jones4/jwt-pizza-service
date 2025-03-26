const config = require('./config');
const Logger = require('pizza-logger');

const logger = new Logger(config)

function sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
}

function sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.userId}:${config.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
}

const httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      logger.httpLogger(req, res);
      sendLogToGrafana({ level: 'info', type: 'http', logData })
      send.call(res, resBody);
    };
    next();
};

const dbLogger = (sqlQuery) =>
{
    logger.dbLogger(sanitize(sqlQuery));
    sendLogToGrafana({ level: 'info', type: 'database', logData: { query: sqlQuery } });
}

const factoryLogger = (orderInfo) => 
{
    logger.factoryLogger(sanitize(orderInfo));
    sendLogToGrafana({ level: 'info', type: 'factory', logData: orderInfo });
};

const unhandledErrorLogger = (err) => 
{
    logger.unhandledErrorLogger(sanitize(err));
    sendLogToGrafana({ level: 'error', type: 'unhandled_exception', logData: { error: err.message, stack: err.stack } });
};

module.exports = {
    httpLogger,
    dbLogger,
    factoryLogger,
    unhandledErrorLogger,
};