const corsMiddleware = require('cors');
const { json } = require('body-parser');
const { renderPlaygroundPage } = require('@apollographql/graphql-playground-html');
const { processFileUploads, formatApolloErrors } = require('apollo-server-core');
const accepts = require('accepts');
const { graphqlExpress } = require('apollo-server-express/dist/expressApollo');
const { ApolloServer } = require('apollo-server-express');
const typeis = require('type-is');

const fileUploadMiddleware = (uploadsConfig, server) => (req, res, next) => {
  if (typeof processFileUploads === 'function' && typeis(req, ['multipart/form-data'])) {
    processFileUploads(req, res, uploadsConfig)
      .then(body => {
        req.body = body;
        next();
      })
      .catch(error => {
        if (error.status && error.expose) res.status(error.status);

        next(
          formatApolloErrors([error], {
            formatter: server.requestOptions.formatError,
            debug: server.requestOptions.debug
          })
        );
      });
  } else {
    next();
  }
};

class ApolloMiddleware {
  constructor(config) {
    this.apolloServer = new ApolloServer(config);
  }
  applyMiddleware({ app, path, cors, bodyParserConfig, disableHealthCheck, onHealthCheck }) {
    if (!path) {
      path = '/graphql';
    }

    const promiseWillStart = this.apolloServer.willStart();
    app.use(path, (_req, _res, next) => {
      promiseWillStart.then(() => next()).catch(next);
    });

    if (!disableHealthCheck) {
      app.use('/.well-known/apollo/server-health', (req, res) => {
        res.type('application/health+json');
        if (onHealthCheck) {
          onHealthCheck(req)
            .then(() => {
              res.json({ status: 'pass' });
            })
            .catch(() => {
              res.status(503).json({ status: 'fail' });
            });
        } else {
          res.json({ status: 'pass' });
        }
      });
    }

    let uploadsMiddleware;
    if (this.apolloServer.uploadsConfig && typeof processFileUploads === 'function') {
      uploadsMiddleware = fileUploadMiddleware(this.apolloServer.uploadsConfig, this.apolloServer);
    }

    this.apolloServer.graphqlPath = path;

    if (cors === true) {
      app.use(path, corsMiddleware());
    } else if (cors !== false) {
      app.use(path, corsMiddleware(cors));
    }

    if (bodyParserConfig === true) {
      app.use(path, json());
    } else if (bodyParserConfig !== false) {
      app.use(path, json(bodyParserConfig));
    }

    if (uploadsMiddleware) {
      app.use(path, uploadsMiddleware);
    }

    app.use(path, (req, res, next) => {
      if (this.apolloServer.playgroundOptions && req.method === 'GET') {
        const accept = accepts(req);
        const types = accept.types();
        const prefersHTML = types.find(x => x === 'text/html' || x === 'application/json') === 'text/html';

        if (prefersHTML) {
          const playgroundRenderPageOptions = {
            cdnUrl: '//unpkg.com',
            endpoint: path,
            subscriptionEndpoint: this.apolloServer.subscriptionsPath,
            ...this.apolloServer.playgroundOptions
          };
          res.setHeader('Content-Type', 'text/html');
          const playground = renderPlaygroundPage(playgroundRenderPageOptions);
          res.write(playground);
          res.end();
          return;
        }
      }
      return graphqlExpress(() => {
        return this.apolloServer.createGraphQLServerOptions(req, res);
      })(req, res, next);
    });
  }
  restart(config) {
    this.apolloServer = new ApolloServer(config);
  }
}

module.exports = {
  ApolloMiddleware
};
