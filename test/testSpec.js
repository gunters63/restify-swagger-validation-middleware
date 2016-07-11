'use strict';

const middleware = require('../');
const expect = require('chai').expect;
const httpMocks = require('node-mocks-http');

describe('test', function () {

  it('passes', function () {
    let handler = middleware();
    let request = httpMocks.createRequest({
      method: 'GET',
      url: '/user/42',
      params: {
        id: 42
      }
    });
    let response = httpMocks.createResponse();
    handler(request, response);
  });
});
