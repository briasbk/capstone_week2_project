const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const VERSION = process.env.APP_VERSION || '2.0.0';

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    version: VERSION,
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the AWS CI/CD Capstone Project!',
    status: 'Fully Operational',
    version: VERSION,
    endpoints: {
      health: '/health',
      info: '/api/info',
      metrics: '/metrics',
      demo: '/demo'
    }
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    appName: 'AWS CI/CD Capstone Project',
    version: VERSION,
    environment: ENVIRONMENT,
    architecture: {
      source: 'GitHub',
      build: 'AWS CodeBuild',
      registry: 'Amazon ECR',
      deploy: 'AWS CodeDeploy',
      compute: 'Amazon ECS Fargate'
    }
  });
});

app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AWS CI/CD Capstone Demo</title>
        <style>
            body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 50px; }
            .container { background: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: auto; }
            h1 { color: #667eea; }
            .status { background: #4CAF50; color: white; padding: 10px; border-radius: 5px; text-align: center; }
            .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>AWS CI/CD Pipeline Demo</h1>
            <div class="status">Application Successfully Deployed!</div>
            <div class="info">
                <p><strong>Environment:</strong> ${ENVIRONMENT}</p>
                <p><strong>Version:</strong> ${VERSION}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                <p><strong>Platform:</strong> Amazon ECS Fargate</p>
            </div>
        </div>
    </body>
    </html>
  `);
});

app.get('/metrics', (req, res) => {
  res.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  server.close(() => console.log('Server closed'));
});

module.exports = app;