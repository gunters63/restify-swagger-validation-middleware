# restify-swagger-validation-middleware
**Restify middleware for validating REST requests with swagger specifications.**

Validates all query, route and body parameters according to the swagger definition.

This library is not production-ready yet, consider this pre-alpha.

*How it works:*

This middleware requires the built-in restify plugins queryParse and bodyParser loaded before it, both with ````mapParams```` set to ````false````.

It also requires a valid de-referenced swagger 2.0 definition, you can use the module ````swagger-parser```` for this.

For every incoming request it will look up the swagger definition for the parameters for the active route and operation 
(swagger allows parameters on the whole route and on specific operations on the route, the middleware will merge both).
It will then create a JSON schema which validates all query, body and route parameters at once. It then compiles this 
schema (using the great ````ajv```` library) to a javascript function which validates the data from the request. The 
generated function for this route and operatinm is cached through ````lodash.memoize()````.

````ajv```` will also handle settings defaults and type coercion.   

The middleware will create a swagger object on the restify request: ````req.swagger````.

The swagger object will contain the following properties:

- ````api````: contains the parsed swaggerAPI
- ````query````: contains all query parameters, type-coerced and with defaults
- ````path````: contains all route path parameters, type-coerced and with defaults
- ````body````: contains all body parameters, type-coerced and with defaults
- ````params````: contains all query, path and body parameters merged together 

The middleware will NOT change existing values in req.query, req.params and req.body.

If validation succeeds, the next middleware will just be called with ````next()````

If validation fails, per default a restify ValidationError (BadRequest, status 400) will be generated.
The error will contain the error collection from ````ajv````.

The generated Error can be customized by passing  ````errorTransformer```` and ````errorResponder```` in the middleware options.

A typical validation error response body will look like this:

    {
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
    }

*Example usage of middleware:*

    const restify = require('restify');
    const SwaggerParser = require('swagger-parser');
    const restifySwaggerValidationMiddleware = require('restify-swagger-validation-middleware');

    // In a real world project you would read your api from the file system
    let api = {
        swagger: '2.0',
        info: {title: 'test', version: '1.0'},
        paths: {
          '/test': {
            get: {
              parameters: [{name: 'test', type: 'integer', in: 'query', required: true}],
              responses: {'200': {description: 'no content'}}
            }
          }
        }
    };
    
    SwaggerParser.validate(api)
      .then((swaggerAPI) => {
        let options = {};
        server = restify.createServer();
        // validation middleware requires query and body parser to be used,
        // both have to disable mapping their properties into req.params
        // so req.params only contains the route path parameters.
        server.use(restify.queryParser({mapParams: false}));
        server.use(restify.bodyParser({mapParams: false}));
        server.use(restifySwaggerValidationMiddleware(swaggerAPI, options));
    
        server.listen(PORT, '127.0.0.1', () => {
           // your code
        })
      })

*Notes:*

- The middleware could easily be ported to express I guess as it has no direct dependency on restify and middlewares look 
quite the same in restify and express. What hat to change is the validation error handling as that needs restify-errors.
- Also, it should be easy to use the same mechanism (mainly delegating everything to avj) with RAML instead of swagger,
it should be even easier because RAML is much closer to the JSON schema standard and body and query parameters are not
handled differently like in swagger.
