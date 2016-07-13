# restify-swagger-validation-middleware
Restify middleware for validating REST requests with swagger specifications

Validates all query, route and body parameters according to the swagger definition.

The library is not production-ready yet, consider this pre-alpha.

*Usage:*

This middleware requires the built-in restify plugins queryParse and bodyParser loaded before it, both with ````mapParams```` set to ````false````

It also requires a valid de-referenced swagger 2.0 definition, you can use the module ````swagger-parser```` for this

The middleware will create a swagger property on the restify request.
The property will contain:

- api: contains the parsed swaggerAPI
- query: contains all query parameters, type-coerced and with defaults
- path: contains all route path parameters, type-coerced and with defaults
- body: contains all body parameters, type-coerced and with defaults
- params: contains all query, path and body parameters merged together 
- the middleware will NOT change existing values in req.query, req.params and req.body.

*Example:*

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
        let options = null; // No options yet 
        server = restify.createServer();
        // validation middleware requires query and body parser to be used,
        // both have to disable mapping their properties into req.params
        // so req.params only contains the route path parameters.
        server.use(restify.queryParser({mapParams: false}));
        server.use(restify.bodyParser({mapParams: false}));
        server.use(restifySwaggerValidationMiddleware(options, swaggerAPI));
    
        server.listen(PORT, '127.0.0.1', () => {
           // your code
        })
      })
