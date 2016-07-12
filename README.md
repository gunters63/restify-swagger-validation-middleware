# restify-swagger-validation-middleware
Restify middleware for validating REST requests with swagger specifications

Usage:

This middleware requires the built-in restify plugins queryParse and bodyParser loaded before it, both with ````mapParams```` set to ````false````

It also requires a valid de-referenced swagger 2.0 definition, you can use the module ````swagger-parser```` for this

Example:

    const restify = require('restify');
    const SwaggerParser = require('swagger-parser');

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
        server.use(restify.queryParser({mapParams: false}));
        server.use(restify.bodyParser({mapParams: false}));
        server.use(middleware(options, swaggerAPI));
    
        server.listen(PORT, '127.0.0.1', () => {
           // your code
        })
      })
