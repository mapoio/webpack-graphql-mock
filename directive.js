const { defaultFieldResolver } = require('graphql');
const { SchemaDirectiveVisitor } = require('graphql-tools');

class MockDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    field.resolve = async (...args) => {
      const result = await resolve.apply(this, args);
      return result;
    };
  }
}

class FakeDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    field.resolve = async (...args) => {
      const result = await resolve.apply(this, args);
      return result;
    };
  }
}

module.exports = {
  MockDirective,
  FakeDirective
};
