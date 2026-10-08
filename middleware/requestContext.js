const crypto = require('crypto');

function requestContext(req, res, next) {
  req.requestId = crypto.randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = requestContext;
