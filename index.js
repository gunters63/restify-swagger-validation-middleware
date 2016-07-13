'use strict';

const Ajv = require('ajv');
const restify = require('restify-errors');
const _ = require('lodash');
const url = require('url');
const util = require('util');

_.mixin({
  collectionOmit: function (collection, keys) {
    return _.map(collection, function (entry) {
      return _.omit(entry, keys);
    });
  }
});

function ValidationError(message, errors) {
  restify.RestError.call(this, {
    restCode: 'ValidationError',
    statusCode: 400,
    message: message,
    constructorOpt: ValidationError
  });
  this.name = 'ValidationError';
  this.body.errors = _.collectionOmit(errors, ['parentSchema']);
}

util.inherits(ValidationError, restify.RestError);
const defaultErrorTransformer = (input, errors) => {
  return new ValidationError('Validation error', errors);
};

const defaultErrorResponder = (transformedErr, req, res, next) => {
  next(transformedErr);
};

function convertRestifyRouteToSwaggerOperationPath(restifyRoute) {
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

function addSwaggerParametersToJsonSchema(currentSchema, parameters) {
  return _.reduce(parameters, (schema, parameter) => {
    // We assume that the swagger specification is valid, 
    // .i.e. all required properties are there and have the expected types
    let name = parameter.name;
    let _in = parameter.in;
    let required = parameter.required;
    let operation;
    let propertySchema;
    switch (_in) {
      case 'body':
        if (parameter.schema.$ref) {
          throw restify.InternalServerError('Swagger schema should be de-referenced')
        }
        schema.properties.body = parameter.schema;
        break;
      case 'query':
      case 'path':
        operation = (_in === 'query') ? schema.properties.query : schema.properties.params;
        // Pick the JSON compatible schema properties
        propertySchema = _.pick(parameter, [
          'type', 'default', 'enum', 'multipleOf', 'format', 'maximum', 'exclusiveMaximum', 'minimum',
          'exclusiveMinimum', 'maxLength', 'minLength', 'pattern', 'maxItems', 'minItems', 'uniqueItems',
          'maxProperties', 'minProperties',
          'items', 'allOf', 'properties', 'additionalProperties' // Not sure yet about those
        ]);
          operation.properties[name] = propertySchema;
        break;
      default:
        // Ignore header and formData (for now)
        break;
    }
    if (operation && propertySchema) {
      if (required) {
        if (operation.required) {
          operation.required.push(name)
        } else {
          operation.required = [name]
        }
      }
    }
    return schema
  }, currentSchema);
}

function createJsonSchemaFromSwaggerParameters(pathParameters, operationParameters) {
  let initialJsonSchema = {
    '$schema': 'http://json-schema.org/draft-04/schema#',
    type: 'object',
    properties: {
      body: {type: 'object', properties: {}},
      query: {type: 'object', properties: {}},
      params: {type: 'object', properties: {}}
    }
  };
  return addSwaggerParametersToJsonSchema(addSwaggerParametersToJsonSchema(initialJsonSchema, pathParameters),
    operationParameters);
}

module.exports = function (options, swaggerApi) {
  // Use npm module swagger-parser to get a validated and de-referenced swagger object
  options = options || {};
  swaggerApi = swaggerApi || {};
  let ajvOptions = options.ajv || {
      v5: true,
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
      verbose: true,
      removeAdditional: true // Todo: Do we want to use that?
    };

  let errorTransformer = options.errorTransformer || defaultErrorTransformer;
  let errorResponder = options.errorResponder || defaultErrorResponder;

  let ajv = new Ajv(ajvOptions);

  function createJsonValidatorFromSwaggerParameters(key, pathParameters, operationParameters) {
    return ajv.compile(createJsonSchemaFromSwaggerParameters(pathParameters, operationParameters));
  }

  let memoizedValidator = _.memoize(createJsonValidatorFromSwaggerParameters);

  return function restifyMiddleware(req, res, next) {

    req.swagger = req.swagger || {};
    req.swagger.api = swaggerApi;

    // Todo: Respect swaggers basePath
    let swaggerPath = convertRestifyRouteToSwaggerOperationPath(req.route.path);

    // 'parameters' can be found under the root object (where they can be linked to with a $ref, should be already de-referenced),
    // under 'path' (then its valid for every operation under that path)
    // and under 'operation', those override parameters with the same name in the parent path item object
    let pathParameterKey = `paths[${swaggerPath}].parameters`;
    let operationParameterKey = `paths[${swaggerPath}][${req.route.method.toLowerCase()}].parameters`;
    let pathParameters = _.get(swaggerApi, pathParameterKey);
    let operationParameters = _.get(swaggerApi, operationParameterKey);

    // We assume we have the standard restify middlewares queryParser and bodyParser loaded, both with {mapParams: false}.
    // So req.params will contain all route parameters, req.query all query parameters, and req.body all body.parameters.
    // We have to make copies of all values because the validator will change the data to validate in-place 
    // (for settings defaults and type coercion).
    let dataToValidate = {
      params: _.assign({}, req.params),
      query: _.assign({}, req.query),
      body: _.assign({}, req.body)
    };
    // console.log(JSON.stringify(dataToValidate, null, 4));

    if (!pathParameters && !operationParameters) {
      errorResponder(errorTransformer(dataToValidate), req, res, next);
      return;
    }
    try {
      // Lazily create the JSON schema and validator and cache it
      let validator = memoizedValidator(operationParameterKey, pathParameters, operationParameters);
      let dataIsValid = validator(dataToValidate);
      // We will add parameter defaults and type coercion, but we don't want to modify the existing parameters,
      // instead we add a req.swagger which will contain query, body, 

      if (!dataIsValid) {
        // console.log(JSON.stringify(validator.errors, null, 4));
        errorResponder(errorTransformer(dataToValidate, validator.errors), req, res, next);
        return;
      }
      // Make swaggerized parameters available
      _.assign(req.swagger, dataToValidate);
      // console.log(JSON.stringify(dataToValidate, null, 4));
      next();
    }
    catch (err) {
      errorResponder(err, req, res, next);
    }
  };
};

module.exports.convertRestifyRouteToSwaggerOperationPath = convertRestifyRouteToSwaggerOperationPath;

module.exports.createJsonSchemaFromSwaggerParameters = createJsonSchemaFromSwaggerParameters;
