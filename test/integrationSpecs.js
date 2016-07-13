'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const restify = require('restify');
const supertest = require('supertest-as-promised');
const SwaggerParser = require('swagger-parser');

const middleware = require('../');

let PORT = process.env.UNIT_TEST_PORT || 8080;
const swaggerStub = {
  swagger: '2.0',
  info: {title: 'test', version: '1.0'}
};

describe('middleware', function () {
  let server;
  let request;

  function getRequestAsync(api, route) {
    route = route || '/test';
    return SwaggerParser.validate(api)
      .then((swaggerAPI) => {
        server.use(middleware(null, swaggerAPI));
        server.get(route, (req, res) => res.send(200));
        return request
      })
  }

  beforeEach('starting restify server', function (done) {
    server = restify.createServer();
    // validation middleware requires query and body parser to be used,
    // both have to disable mapping their properties into req.params
    server.use(restify.queryParser({mapParams: false}));
    server.use(restify.bodyParser({mapParams: false}));

    server.listen(PORT, '127.0.0.1', () => {
      request = supertest(server);
      done();
    })
  });

  afterEach('stopping restify server', function (done) {
    try {
      server.close(function () {
        server = null;
        done();
      });
    }
    catch (e) {
      console.error(e.stack);
      process.exit(1);
    }
  });

  it('returns bad request status when swagger validation information is missing', function () {
    server.use(middleware());
    server.get('/test', (req, res) => res.send(200));
    return request
      .get('/test')
      .expect(400)
  });

  describe('validate query parameters', function () {
    let integerAPI = _.assign({}, swaggerStub, {
      paths: {
        '/test': {
          get: {
            parameters: [{name: 'test', type: 'integer', in: 'query', required: true}],
            responses: {'200': {description: 'no content'}}
          }
        }
      }
    });

    let enumAPI = _.assign({}, swaggerStub, {
      paths: {
        '/test': {
          get: {
            parameters: [{name: 'test', type: 'string', enum: ['enum1', 'enum2'], in: 'query', required: true}],
            responses: {'200': {description: 'no content'}}
          }
        }
      }
    });

    it('should not validate when a required query parameter is missing', function () {
      return getRequestAsync(integerAPI)
        .then((request) => {
          return request
            .get('/test?no_test=1')
            .expect(400)
        })
    });

    it('should validate when a required query parameter exists', function () {
      return getRequestAsync(integerAPI)
        .then((request) => {
          return request
            .get('/test?test=1')
            .expect(200)
        })
    });

    it('should not validate when a query parameter has the wrong type (string instead integer)', function () {
      return getRequestAsync(integerAPI)
        .then((request) => {
          return request
            .get('/test?test=abc')
            .expect(400, {
              "code": "ValidationError",
              "errors": [
                {
                  "data": "abc",
                  "dataPath": ".query.test",
                  "keyword": "type",
                  "message": "should be integer",
                  "params": {
                    "type": "integer"
                  },
                  "schema": "integer",
                  "schemaPath": "#/properties/query/properties/test/type"
                }
              ],
              "message": "Validation error"
            })
        });
    });

    it('should not validate when a query parameter has the wrong enum', function () {
      return getRequestAsync(enumAPI)
        .then((request) => {
          return request
            .get('/test?test=abc')
            .expect(400, {
              "code": "ValidationError",
              "errors": [
                {
                  "data": "abc",
                  "dataPath": ".query.test",
                  "keyword": "enum",
                  "message": "should be equal to one of the allowed values",
                  "params": {},
                  "schema": [
                    "enum1",
                    "enum2"
                  ],
                  "schemaPath": "#/properties/query/properties/test/enum"
                }
              ],
              "message": "Validation error"
            })
        });
    })
  });

  it('validates route params and query parameters at the same time', function () {
    let myAPI = _.assign({}, swaggerStub, {
      paths: {
        '/test/{id}': {
          parameters: [{name: 'id', type: 'string', in: 'path', required: true}],
          get: {
            parameters: [{name: 'test', type: 'integer', in: 'query', required: true}],
            responses: {'200': {description: 'no content'}}
          }
        }
      }
    });
    return SwaggerParser.validate(myAPI)
      .then((swaggerAPI) => {
        server.use(middleware(null, swaggerAPI));
        server.get('/test/:id', (req, res) => res.send(200));
        return request
          .get('/test/12?test=1')
          .expect(200)
      })
  });

  it('should not validate when the POST body does not follow the given schema', function () {
    let myAPI = _.assign({}, swaggerStub, {
      paths: {
        '/test': {
          post: {
            parameters: [{
              name: 'body',
              in: 'body',
              required: true,
              schema: {
                type: 'object',
                properties: {id: {type: 'integer'}},
                required: ['id']
              }
            }],
            responses: {'200': {description: 'no content'}}
          }
        }
      }
    });
    return SwaggerParser.validate(myAPI)
      .then((swaggerAPI) => {
        server.use(middleware(null, swaggerAPI));
        server.post('/test', (req, res) => res.send(200));
        return request
          .post('/test')
          .send({no_id: 1})
          .expect(400)
      })
  });

  it('should validate when the POST body follows the given schema', function () {
    let myAPI = _.assign({}, swaggerStub, {
      paths: {
        '/test': {
          post: {
            parameters: [{
              name: 'body',
              in: 'body',
              required: true,
              schema: {
                type: 'object',
                properties: {id: {type: 'integer'}},
                required: ['id']
              }
            }],
            responses: {'200': {description: 'no content'}}
          }
        }
      }
    });
    return SwaggerParser.validate(myAPI)
      .then((swaggerAPI) => {
        server.use(middleware(null, swaggerAPI));
        server.post('/test', (req, res) => res.send(200));
        return request
          .post('/test')
          .send({id: 1})
          .expect(200)
      })
  });

});
