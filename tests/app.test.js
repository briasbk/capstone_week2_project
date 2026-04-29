const request = require('supertest');
const app = require('../src/app');

describe('Application Tests', () => {
  describe('GET /', () => {
    it('should return welcome message with correct structure', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('AWS CI/CD Capstone Project');
      expect(response.body).toHaveProperty('status', 'Fully Operational');
      expect(response.body).toHaveProperty('endpoints');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/info', () => {
    it('should return application information', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('appName');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toContain('Automated CI/CD Pipeline');
    });
  });

  describe('GET /metrics', () => {
    it('should return system metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);
      
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('nodeVersion');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});

describe('Performance Tests', () => {
  it('should handle multiple requests quickly', async () => {
    const requests = Array(10).fill().map(() => request(app).get('/'));
    const responses = await Promise.all(requests);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});