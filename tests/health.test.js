const request = require('supertest');
const app = require('../src/app');

describe('Health Check Suite', () => {
  test('Health endpoint responds quickly', async () => {
    const start = Date.now();
    await request(app).get('/health').expect(200);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should respond within 100ms
  });

  test('Root endpoint returns correct content type', async () => {
    const response = await request(app)
      .get('/')
      .expect('Content-Type', /json/);
    expect(response.headers['content-type']).toMatch(/json/);
  });

  test('Version is consistent across endpoints', async () => {
    const [rootRes, healthRes, infoRes] = await Promise.all([
      request(app).get('/'),
      request(app).get('/health'),
      request(app).get('/api/info')
    ]);
    
    const version = rootRes.body.version;
    expect(healthRes.body.version).toBe(version);
    expect(infoRes.body.version).toBe(version);
  });
});