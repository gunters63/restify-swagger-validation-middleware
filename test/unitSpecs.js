'use strict';

const convertRestifyRouteToSwaggerPath = require('../').convertRestifyRouteToSwaggerPath;
const expect = require('chai').expect;

describe('Convert routes', function () {
  it('converts a restify route correctly to a swagger path #1', function () {
    expect(convertRestifyRouteToSwaggerPath('')).to.equal('')
  });

  it('converts a restify route correctly to a swagger path #2', function () {
    expect(convertRestifyRouteToSwaggerPath('/users/:id')).to.equal('/users/{id}')
  });

  it('converts a restify route correctly to a swagger path #3', function () {
    expect(convertRestifyRouteToSwaggerPath('/users/:id/test/:id2')).to.equal('/users/{id}/test/{id2}')
  });

  it('converts a restify route correctly to a swagger path #4', function () {
    expect(convertRestifyRouteToSwaggerPath('/users/test')).to.equal('/users/test')
  });

  it('converts a restify route correctly to a swagger path #5', function () {
    expect(convertRestifyRouteToSwaggerPath('/users/test?q=aaa')).to.equal('/users/test')
  });
});
