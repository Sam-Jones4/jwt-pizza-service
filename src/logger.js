const config = require('./config.json');
const Logger = require('pizza-logger');

const logger = new Logger(config)

function sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
}

httpLogger = (req, res, next) => {
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
      send.call(res, resBody);
    };
    next();
};

const dbLogger = (sqlQuery) =>
{
    logger.dbLogger(sanitize(sqlQuery));
}

const factoryLogger = (orderInfo) => 
{
    logger.factoryLogger(sanitize(orderInfo));
};

const unhandledErrorLogger = (err) => 
{
    logger.unhandledErrorLogger(sanitize(err));
};

module.exports = {
    httpLogger,
    dbLogger,
    factoryLogger,
    unhandledErrorLogger,
};