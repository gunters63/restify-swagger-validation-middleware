'use strict';

const middleware = require('../');
const expect = require('chai').expect;
const restify = require('restify');
const supertest = require('supertest-as-promised');

var PORT = process.env.UNIT_TEST_PORT || 8080;

describe('middleware', function () {
  let server;
  let request;

  beforeEach('Starting restify server', function (done) {
    server = restify.createServer();
    server.listen(PORT, '127.0.0.1', () => {
      request = supertest(server);
      done();
    })
  });

  afterEach('Stopping restify server', function (done) {
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

  it('Returns bad request status when swagger validation information is missing', function () {
    server.use(middleware());
    server.get('/users/:id', (req, res, next) => next);
    return request
      .get('/users/12')
      .expect(400)
  });

  it.only('Returns bad request when required query parameter is missing', function () {
    server.use(middleware(null, {
      paths: {
        '/users/{id}': {
          get: {
            parameters: {name: 'test', type: 'string', in: 'query', required: true}
          }
        }
      }
    }));
    server.get('/users/:id', (req, res, next) => next);
    return request
      .get('/users/12')
      .expect(400)
  });

  it('Returns bad request when the POST body does not follow the given schema', function () {
    server.use(middleware(null, {
      paths: {
        '/users': {
          post: {
            parameters: {
              name: 'test', in: 'body', schema: {
                type: 'object', properties: {id: {type: 'integer'}}
              }
            }
          }
        }
      }
    }));
    return request
      .post('/users')
      .send({no_id: 1})
      .expect(400)
  });

  it('Validates ok when the POST body follows the given schema', function () {
    server.use(middleware(null, {
      paths: {
        '/users': {
          post: {
            parameters: {
              name: 'test', in: 'body', schema: {
                type: 'object', properties: {id: {type: 'integer'}}
              }
            }
          }
        }
      }
    }));
    return request
      .post('/users')
      .send({id: 1})
      .expect(400)
  });

});
