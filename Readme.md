# AWS CI/CD Capstone Project: End-to-End Production Pipeline

[![AWS](https://img.shields.io/badge/AWS-100%25-green)](https://aws.amazon.com)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-CodePipeline-blue)](https://aws.amazon.com/codepipeline/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-blue)](https://www.docker.com)
[![ECS](https://img.shields.io/badge/ECS-Fargate-orange)](https://aws.amazon.com/ecs/)

---

## Project Overview

This is a **production-grade, fully automated CI/CD pipeline** on AWS that demonstrates modern DevOps practices. The pipeline automatically takes code from GitHub, builds and tests it, packages it into a Docker container, and deploys it to Amazon ECS Fargate behind an Application Load Balancer with Blue/Green deployment strategy.

### Key Features

- **Complete CI/CD Pipeline**: GitHub → CodeBuild → ECR → CodeDeploy → ECS
- **Containerization**: Dockerized Node.js application
- **Zero-Downtime Deployments**: Blue/Green deployment strategy
- **Comprehensive Monitoring**: CloudWatch alarms with SNS notifications
- **Manual Approval Gate**: Production deployment control
- **Production-Ready**: Security headers, rate limiting, health checks
- **Auto-scaling Ready**: ECS service with scaling policies
- **Secure by Design**: IAM least privilege, non-root containers

##  Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup Guide](#step-by-step-setup-guide)
  - [Step 1: Application & GitHub](#step-1-application--github)
  - [Step 2: Set Up ECR](#step-2-set-up-ecr)
  - [Step 3: ECS Cluster & Service](#step-3-ecs-cluster--service)
  - [Step 4: Configure CodeBuild](#step-4-configure-codebuild)
  - [Step 5: Configure CodeDeploy](#step-5-configure-codedeploy)
  - [Step 6: Create CodePipeline](#step-6-create-codepipeline)
  - [Step 7: Monitoring & Alerts](#step-7-monitoring--alerts)
- [File Reference](#file-reference)
- [Testing Locally](#testing-locally)
- [Troubleshooting](#troubleshooting)

---


## Architecture

```
GitHub (push) 
    │
    ▼
AWS CodePipeline
    │
    ├── Stage 1: SOURCE ──────── GitHub repository
    │
    ├── Stage 2: BUILD ───────── CodeBuild
    │                               ├── Install dependencies
    │                               ├── Run unit tests (Jest)
    │                               ├── Build Docker image
    │                               └── Push image → Amazon ECR
    │
    ├── Stage 3: APPROVAL ─────── Manual approval gate (SNS email)
    │
    ├── Stage 4: DEPLOY ──────── CodeDeploy (Blue/Green)
    │                               └── Update ECS Task Definition
    │                                   └── ECS Fargate Service
    │                                          └── App Load Balancer
    │
    └── Monitoring: CloudWatch Alarms + SNS Notifications


┌─────────────────────────────────────────────────────────────────────────────┐
│                    MY ACTUAL CI/CD ARCHITECTURE                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   GitHub     │────▶│   Docker     │────▶│    ECR       │
│   Repository │     │   Build      │     │  Repository  │
│   (Source)   │     │  (Local/CLI) │     │  (Image Store)│
└──────────────┘     └──────────────┘     └──────────────┘
                             │                    │
                             │                    │
                             ▼                    ▼
                      ┌─────────────────────────────────┐
                      │         AWS ECS Fargate          │
                      │                                  │
                      │  ┌─────────────────────────────┐ │
                      │  │    capstone-service         │ │
                      │  │  ┌─────────┐ ┌─────────┐   │ │
                      │  │  │ Task 1  │ │ Task 2  │   │ │
                      │  │  │Port 3000│ │Port 3000│   │ │
                      │  │  └────┬────┘ └────┬────┘   │ │
                      │  └───────┼───────────┼─────────┘ │
                      │          │           │           │
                      └──────────┼───────────┼───────────┘
                                 │           │
                                 ▼           ▼
                      ┌─────────────────────────────────┐
                      │    Application Load Balancer    │
                      │         capstone-alb            │
                      │                                  │
                      │  Blue Target Group  (capstone-tg)│
                      │  Green Target Group (capstone-tg-green)│
                      └─────────────────────────────────┘
                                      │
                                      ▼
                              ┌─────────────┐
                              │   Users     │
                              │  (Browser)  │
                              └─────────────┘
```

---

## Repository Structure

```
myapp/
├── src/
│   ├── app.js              # Express.js application
│   ├── package.json        # Node.js dependencies
│   └── package-lock.json   # Locked dependency
├── tests/
│   └── app.test.js         # Jest unit tests
    └── health.test.js      # health unit tests
├── Dockerfile              # Multi-stage Docker build
├── buildspec.yml           # CodeBuild instructions
├── appspec.yml             # CodeDeploy ECS deployment spec
├── taskdef.json            # ECS Task Definition template
├── pipeline-diagram.png    # Architecture diagram
└── README.md               # This file
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| AWS Account | With permissions for CodePipeline, CodeBuild, CodeDeploy, ECS, ECR, IAM, CloudWatch |
| GitHub Account | Repository with your code |
| AWS CLI | Installed and configured (`aws configure`) |
| Docker | Installed locally for testing |
| Node.js 18+ | For local development |

---

## Step-by-Step Setup Guide

### Step 1: Application & GitHub

1. Fork or clone this repository to your GitHub account.
2. Ensure your repo is **public** or that you have set up a GitHub connection in AWS.
3. Verify the app runs locally:

```bash
cd src
npm install
npm test        
npm start       
```

---

### Step 2: Set Up ECR

Create the ECR repository where Docker images will be stored:

```bash
aws ecr create-repository \
  --repository-name myapp-repo \
  --region us-east-1
```

Note the **repository URI** returned — you'll need it in later steps.  
Format: `<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/myapp-repo`

---

### Step 3: ECS Cluster & Service

#### 3a. Create ECS Cluster

```
AWS Console → ECS → Clusters → Create Cluster
  Name:              myapp-cluster
  Infrastructure:    AWS Fargate (serverless)
```

#### 3b. Create Application Load Balancer

```
EC2 Console → Load Balancers → Create → Application Load Balancer
  Name:          myapp-alb
  Scheme:        Internet-facing
  Listeners:     HTTP port 80
  Target Group:  myapp-tg-blue  (port 3000, HTTP, /health)
```

Also create a second target group `myapp-tg-green` for Blue/Green.

#### 3c. Register the Task Definition

Update `taskdef.json` with your `<ACCOUNT_ID>`, then register:

```bash
aws ecs register-task-definition \
  --cli-input-json file://taskdef.json \
  --region us-east-1
```

#### 3d. Create ECS Service

```
ECS Console → myapp-cluster → Create Service
  Launch type:       Fargate
  Task definition:   myapp-task
  Service name:      myapp-service
  Desired count:     1
  Load balancer:     myapp-alb
  Deployment type:   Blue/Green (CodeDeploy)
```

---

### Step 4: Configure CodeBuild

#### 4a. Store account ID in Parameter Store

```bash
aws ssm put-parameter \
  --name "/myapp/account_id" \
  --value "<YOUR_ACCOUNT_ID>" \
  --type "String"
```

#### 4b. Create CodeBuild Project

```
CodeBuild Console → Create build project
  Project name:       myapp-build
  Source:             GitHub → your repository
  Environment:        Managed image → Ubuntu → Standard → aws/codebuild/standard:7.0
  Privileged:         YES (required for Docker builds)
  Service role:       Create new or use existing
  Buildspec:          Use buildspec.yml in repo
```

#### 4c. IAM Permissions for CodeBuild Role

Attach these policies to the CodeBuild service role:
- `AmazonECR_FullAccess`
- `AmazonSSMReadOnlyAccess`
- `CloudWatchLogsFullAccess`

---

### Step 5: Configure CodeDeploy

#### 5a. Create CodeDeploy Application

```
CodeDeploy Console → Applications → Create
  Application name:    myapp-deploy
  Compute platform:    Amazon ECS
```

#### 5b. Create Deployment Group

```
  Deployment group name:   myapp-dg
  Service role:            AWSCodeDeployRoleForECS
  ECS cluster:             myapp-cluster
  ECS service:             myapp-service
  Load balancer:           myapp-alb
  Target groups:           myapp-tg-blue / myapp-tg-green
  Deployment config:       CodeDeployDefault.ECSAllAtOnce
  Deployment type:         Blue/Green
```

---

### Step 6: Create CodePipeline

```
CodePipeline Console → Create Pipeline
  Pipeline name:    myapp-pipeline
  Role:             Create new service role
```

**Add stages:**

| Stage | Provider | Config |
|---|---|---|
| Source | GitHub (v2) | Repo: `myapp`, Branch: `main` |
| Build | CodeBuild | Project: `myapp-build` |
| Approval | Manual Approval | SNS topic: `myapp-approvals` (email) |
| Deploy | CodeDeploy | App: `myapp-deploy`, Group: `myapp-dg` |

---

### Step 7: Monitoring & Alerts

#### 7a. Create SNS Topic

```bash
aws sns create-topic --name myapp-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<ACCOUNT_ID>:myapp-alerts \
  --protocol email \
  --notification-endpoint your@email.com
```

Confirm the subscription from your email inbox.

#### 7b. Create CloudWatch Alarm — ECS CPU

```
CloudWatch Console → Alarms → Create Alarm
  Metric:        ECS → ClusterName/ServiceName → CPUUtilization
  Threshold:     > 80% for 2 consecutive periods
  Period:        5 minutes
  Action:        Send notification to myapp-alerts (SNS)
```

#### 7c. Create CloudWatch Alarm — Pipeline Failures

```
  Metric:        CodePipeline → ExecutionsFailed
  Threshold:     >= 1
  Period:        5 minutes
  Action:        Send notification to myapp-alerts (SNS)
```

---

## File Reference

| File | Purpose |
|---|---|
| `src/app.js` | Express.js web application with `/` and `/health` routes |
| `src/package.json` | Node.js dependencies (Express, Jest, Supertest) |
| `tests/app.test.js` | Unit tests using Jest + Supertest |
| `Dockerfile` | Multi-stage Docker build (test → production) |
| `buildspec.yml` | CodeBuild: login to ECR, run tests, build & push image |
| `appspec.yml` | CodeDeploy: Blue/Green ECS deployment specification |
| `taskdef.json` | ECS Task Definition template (Fargate, port 3000) |

---

## Testing Locally

```bash
# Install dependencies
cd src && npm install

# Run tests
npm test

# Build Docker image locally
cd ..
docker build -t myapp:local .

# Run container locally
docker run -p 3000:3000 myapp:local

# Test endpoints
curl http://localhost:3000/          # Main page
curl http://localhost:3000/health    # Health check → {"status":"healthy"}
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| CodeBuild: `docker: Cannot connect to Docker daemon` | Enable **Privileged mode** in CodeBuild environment settings |
| ECR push fails | Ensure CodeBuild IAM role has `ecr:GetAuthorizationToken` and `ecr:InitiateLayerUpload` |
| ECS tasks not starting | Check CloudWatch Logs under `/ecs/myapp-task` for container errors |
| ALB health checks failing | Ensure security group allows port 3000 inbound from ALB |
| CodeDeploy stuck | Verify `appspec.yml` container name matches `taskdef.json` exactly |
| Pipeline not triggering | Check GitHub connection is authorized in AWS Developer Tools |

---
Deployed on Amazon ECS Fargate with full Blue/Green CI/CD automation.

### Live Application Access

- Root: http://capstone-alb-2089285546.us-east-1.elb.amazonaws.com/
- Health: http://capstone-alb-2089285546.us-east-1.elb.amazonaws.com/health
- API Info: http://capstone-alb-2089285546.us-east-1.elb.amazonaws.com/api/info
- Demo: http://capstone-alb-2089285546.us-east-1.elb.amazonaws.com/demo

## Deployment Screenshots

### Project Structure & Local Testing

![Project Structure](images/project-structure.png)
*Figure 1: Local project structure showing all directories and files*

![Health Endpoint Test](images/health-Endpoint-Test.png)
*Figure 2: Local testing of health endpoint showing successful response*

![Root Endpoint Test](images/Root-Endpoint-Test.png)
*Figure 3: Local testing of root endpoint showing welcome message*

![Demo Page](images/demopage.png)
*Figure 4: Local demo page displaying deployment information*

### AWS Infrastructure Setup

![Load Balancer Active](images/loadbalance-active.png)
*Figure 5: Application Load Balancer (capstone-alb) successfully created and active*

![Target Group Created](images/target-group-created.png)
*Figure 6: Target group (capstone-tg) configured for ECS Fargate tasks*

![Deployment Completed](images/deployment-completed.png)
*Figure 7: ECS Service showing 2 running tasks with steady state*

### Application Endpoints - AWS Deployment

![Root Endpoint](images/root_endpoint.png)
*Figure 8: Root endpoint returning welcome message with pipeline information*

![Health Endpoint](images/health_endpoint.png)
*Figure 9: Health check endpoint showing application status with version 2.0.0*

![API Info Endpoint](images/API_info_endpoint.png)
*Figure 10: API information endpoint displaying application metadata and architecture*

![Demo Page Deployment](images/Demo_page_deployment.png)
*Figure 11: HTML demo page showing successful deployment on ECS Fargate*

### AWS CLI Verification

![CLI Root and Health Endpoints](images/AWS-cli-root-health-endpoints.png)
*Figure 12: AWS CLI showing successful API responses for root and health endpoints*

![CLI Demo Page](images/AWS-cli-Demo-Page-endpoint.png)
*Figure 13: AWS CLI displaying demo page HTML output*

### Monitoring and Alerts Verification

![CLI Verification Report](images/verification-cli-report.png)
*Figure 14: Complete CLI verification showing ECS service, load balancer, ECR image, CloudWatch alarms, and SNS topic*

![CloudWatch Dashboard](images/dashboard.png)
*Figure 15: CloudWatch monitoring dashboard displaying ECS service health metrics, load balancer performance, and task health*

![SNS Subscription Confirmation](images/email-sns.png)
*Figure 16: SNS subscription confirmation email received and confirmed for monitoring alerts*

![SNS Test Notification](images/AWS-Notification-Test-Notification.png)
*Figure 17: Test notification from CloudWatch alarms demonstrating working alert system*