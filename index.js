const useMock = require('./mock').useMock;

const createWebpackGraphqlMockMiddleware = (schemaPath, urlPath) => {
  return (app, server) => {
    useMock(app, schemaPath, urlPath);
  };
};

const expressGraphqlMockMiddleware = useMock;

module.exports = {
  createWebpackGraphqlMockMiddleware,
  expressGraphqlMockMiddleware
};
