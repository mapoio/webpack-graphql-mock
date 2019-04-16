const { ApolloServer } = require('apollo-server-express');
const { MockList } = require('graphql-tools');
const { get } = require('lodash');
const { GraphQLScalarType, GraphQLList } = require('graphql');
const Mock = require('mockjs');
const directive = require('./directive');
const fs = require('fs');
const path = require('path');
const { fakeValue } = require('./fake');
const chokidar = require('chokidar');
const chalk = require('chalk');
const ApolloMiddleware = require('./ApolloServer').ApolloMiddleware;
const Random = Mock.Random;

const typeResolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: '时间',
    parseValue(value) {
      return new Date(value);
    },
    serialize(value) {
      // return new Date(value).getTime()
      return new Date(value); // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return parseInt(ast.value, 10); // ast value is always in string format
      }
      return null;
    }
  })
};

const resolveDirectives = directives => {
  const result = directives.reduce((memo, directive) => {
    const name = directive.name.value;
    const args = directive.arguments || [];
    memo[name] = args.reduce((obj, arg) => {
      const argName = arg.name.value;
      obj[argName] = arg.value.value;
      return obj;
    }, {});
    return memo;
  }, {});
  return result;
};

const getCilentDirectivesParams = ({ fieldNodes = {} }) => {
  const directives = get(fieldNodes, '0.directives') || [];
  return resolveDirectives(directives);
};

const getSchemaDirectivesParams = ({ parentType = {}, fieldName = 'MUST BE FILED NAME' }) => {
  const field = get(parentType, `_fields.${fieldName}`) || {};
  const directives = get(field, 'astNode.directives') || [];
  return resolveDirectives(directives);
};

const list = (_, args, context, info) => {
  if (info.returnType instanceof GraphQLList) {
    const limit = args.limit || Random.natural(5, 15);
    return new MockList(parseInt(limit) * 1);
  } else {
    return info.returnType._fields;
  }
};

const proxy = new Proxy(
  {},
  {
    get: function() {
      return list;
    }
  }
);

const mockFunc = args => {
  try {
    const ast = args[3];
    const directives = getSchemaDirectivesParams(ast);
    const clientDirectives = getCilentDirectivesParams(ast);
    const cilentMockRule = clientDirectives.mock && clientDirectives.mock.rule;
    const mockRule = directives.mock && directives.mock.rule;
    const clientFake = clientDirectives.fake;
    const fake = directives.fake;
    let res = false;
    if (clientFake) {
      res = fakeValue(clientFake.type, clientFake.options, (clientFake.locale = 'zh_CN'));
    } else if (fake) {
      res = fakeValue(fake.type, fake.options, (fake.locale = 'zh_CN'));
    } else if (cilentMockRule) {
      res = Mock.mock(cilentMockRule);
    } else if (mockRule) {
      res = Mock.mock(mockRule);
    } else {
      res = false;
    }
    return res;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const min = 100;
const max = 99999;
const mocks = {
  Boolean: (...args) => {
    const res = mockFunc(args);
    return (res !== false && Boolean(res)) || Random.boolean();
  },
  Int: (...args) => {
    const res = mockFunc(args);
    return (res !== false && parseInt(res)) || Random.natural(min, max);
  },
  Float: (...args) => {
    const res = mockFunc(args);
    return (res !== false && parseFloat(res)) || Random.float(min, max);
  },
  String: (...args) => {
    const res = mockFunc(args);
    return (res && `${res}`) || Random.ctitle(10, 5);
  },
  Date: () => Random.time(),
  Query: () => proxy
};

const getConfig = schemaPath => {
  const customSchema = schemaPath || path.join(__dirname, './generated-schema.gql');
  const defaultTypeDefs = fs.readFileSync(path.join(__dirname, './default.graphql')).toString();
  const typeDefs = fs.readFileSync(customSchema).toString();
  return {
    typeDefs: defaultTypeDefs + typeDefs,
    typeResolvers,
    mocks,
    schemaDirectives: {
      mock: directive.MockDirective,
      fake: directive.FakeDirective
    },
    preserveResolvers: false,
    introspection: true,
    playground: true
  };
};

const useFake = (app, schemaPath, urlPath) => {
  const GQLPath = urlPath || '/graphql';
  const customSchema = schemaPath || path.join(__dirname, './generated-schema.gql');
  const watcher = chokidar.watch(customSchema);
  let config = getConfig(schemaPath);
  const server = new ApolloMiddleware(config);
  server.applyMiddleware({ app, path: GQLPath });
  watcher.on('change', () => {
    console.log('Reastrt GraphQL Mock Server');
    config = getConfig(schemaPath);
    server.restart(config);
    console.log(`\n${chalk.green('✔')} Your GraphQL Fake API is ready to use 🚀\n`);
  });
  console.log(`\n${chalk.green('✔')} Your GraphQL Fake API is ready to use 🚀\n`);
};

module.exports = {
  useFake,
  useMock: useFake
};
