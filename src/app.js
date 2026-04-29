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

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    version: VERSION,
    uptime: process.uptime()
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    appName: 'AWS CI/CD Capstone Project',
    version: VERSION,
    environment: ENVIRONMENT,
    features: [
      'Automated CI/CD Pipeline',
      'Docker Containerization',
      'ECS Fargate Deployment',
      'Blue/Green Deployments',
      'CloudWatch Monitoring',
      'Auto-scaling',
      'Load Balancing'
    ],
    architecture: {
      source: 'GitHub',
      build: 'AWS CodeBuild',
      registry: 'Amazon ECR',
      deploy: 'AWS CodeDeploy',
      orchestration: 'AWS CodePipeline',
      compute: 'Amazon ECS Fargate',
      monitoring: 'Amazon CloudWatch'
    }
  });
});

// Main endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the AWS CI/CD Capstone Project!',
    subtitle: 'End-to-End Automated Pipeline',
    status: 'Fully Operational',
    deployedAt: new Date().toISOString(),
    version: VERSION,
    endpoints: {
      health: '/health',
      info: '/api/info',
      metrics: '/metrics',
      demo: '/demo'
    },
    pipeline: {
      source: 'GitHub → CodeBuild → ECR → CodeDeploy → ECS',
      type: 'Blue/Green Deployment',
      monitoring: 'CloudWatch Alarms + SNS Notifications'
    }
  });
});

// Demo endpoint with HTML response
app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AWS CI/CD Capstone Demo</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .container {
                background: rgba(255,255,255,0.95);
                color: #333;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            h1 { color: #667eea; }
            .status { 
                background: #4CAF50; 
                color: white; 
                padding: 10px;
                border-radius: 5px;
                text-align: center;
            }
            .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .button {
                background: #667eea;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                display: inline-block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 AWS CI/CD Pipeline Demo</h1>
            <div class="status">Application Successfully Deployed!</div>
            <div class="info">
                <h3>Deployment Information:</h3>
                <p><strong>Environment:</strong> ${ENVIRONMENT}</p>
                <p><strong>Version:</strong> ${VERSION}</p>
                <p><strong>Deployment Time:</strong> ${new Date().toISOString()}</p>
                <p><strong>Container:</strong> Amazon ECS (Fargate)</p>
                <p><strong>Load Balancer:</strong> Application Load Balancer</p>
            </div>
            <a href="/api/info" class="button">View API Info →</a>
        </div>
    </body>
    </html>
  `);
});

// Metrics endpoint (simplified)
app.get('/metrics', (req, res) => {
  res.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: ENVIRONMENT === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Main app: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;