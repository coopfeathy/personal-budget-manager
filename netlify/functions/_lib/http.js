function buildHeaders() {
  const origin = process.env.CORS_ORIGIN || '*';

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  };
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: buildHeaders(),
    body: JSON.stringify(data)
  };
}

function optionsResponse() {
  return {
    statusCode: 204,
    headers: buildHeaders(),
    body: ''
  };
}

module.exports = {
  json,
  optionsResponse
};
