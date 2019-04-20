const express = require('express');
const expressGraphqlMockMiddleware = require('./index').expressGraphqlMockMiddleware;

const app = express()

expressGraphqlMockMiddleware(app)

app.listen(8089, () => {
  console.log('Start express!')
})
