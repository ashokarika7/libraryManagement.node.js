const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Library Management API',
    version: '1.0.0',
    description: 'API documentation for Library Management System',
  },
  servers: [
    {
      url: 'http://localhost:3000', 
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./app.js'], 
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
