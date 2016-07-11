'use strict';

const Ajv = require('ajv');
const restify = require('restify-errors');

const defaultErrorTransformer = (input, errors) => {
  let result = new restify.BadRequestError('Validation error');
  result.errors = errors;
  return result;
};

const defaultErrorResponder = (transformedErr, req, res, next) => {
  next(transformedErr);
};

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

  return function restifyMiddleware(req, res, next) {
    let dataToValidate = {};
    let validate = ajv.compile({});
    let valid = validate(dataToValidate);

    if (!valid) {
      errorResponder(errorTransformer(dataToValidate, validate.errors), req, res, next);
      return;
    }

    if (next) {
      next();
    }
  };
};
