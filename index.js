'use strict';

const Ajv = require('ajv');
const restify = require('restify-errors');
const _ = require('lodash');
const url = require('url');

const defaultErrorTransformer = (input, errors) => {
  let result = new restify.BadRequestError('Validation error');
  result.errors = errors;
  return result;
};

const defaultErrorResponder = (transformedErr, req, res, next) => {
  next(transformedErr);
};

function convertRestifyRouteToSwaggerPath(restifyRoute) {
  let _url = url.parse(restifyRoute).pathname;
  if (!_url) return restifyRoute;
  let slash = ''; // Don't add a slash in front of the first part
  return _.reduce(_url.split('/'), (result, frag) => {
    if (frag.charAt(0) === ':') {
      frag = '{' + frag.substring(1) + '}'
    }
    result += slash + frag;
    slash = '/';
    return result;
  }, '');
}

module.exports = function (options, swagger) {
  options = options || {};
  swagger = swagger || {};
  let ajvOptions = options.ajv || {
      v5: true,
      allErrors: true,
      useDefaults: true,
      coerceTypes: true
    };

  let errorTransformer = options.errorTransformer || defaultErrorTransformer;
  let errorResponder = options.errorResponder || defaultErrorResponder;

  let ajv = new Ajv(ajvOptions);

  // Workflow: 
  // - Walk all swagger paths and methods
  // - Create a single json schema validator for each path and method and compile and cache it
  // - The validator gets an object like: 
  // {
  //   params: {}, 
  //   body: {}, 
  //   query: {},
  //   // optional:
  //   user: {}, 
  //   headers: {}, 
  //   trailers: {}, 
  // }
  // which in turn is created from the corresponding properties of the req object
  // Alternatively we can try not to cache all validators upfront, instead lazy-create and cache
  // them als the middleware is called.
  // Todo: Respect swaggers basePath

  return function restifyMiddleware(req, res, next) {
    let swaggerPath = convertRestifyRouteToSwaggerPath(req.route.path);
    let path = `paths[${swaggerPath}][${req.route.method.toLowerCase()}].parameters`;
    let swaggerParameters = _.get(swagger, path);
    let dataToValidate = {};
    if (!swaggerParameters) {
      errorResponder(errorTransformer(dataToValidate), req, res, next);
      return;
    }
    console.log(options);
    console.log(swaggerParameters);
    let validate = ajv.compile({});
    let valid = validate(dataToValidate);

    if (!valid) {
      errorResponder(errorTransformer(dataToValidate, validate.errors), req, res, next);
      return;
    }

    next();
  };
};

module.exports.convertRestifyRouteToSwaggerPath = convertRestifyRouteToSwaggerPath; // For testing
