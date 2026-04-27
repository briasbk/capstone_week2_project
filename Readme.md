# AWS CI/CD Capstone Project

> End-to-End CI/CD Pipeline using CodePipeline · CodeBuild · CodeDeploy · ECR · ECS (Fargate)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Repository Structure](#4-repository-structure)
5. [Step 1 — Prepare the Application Code](#step-1--prepare-the-application-code)
6. [Step 2 — Set Up Amazon ECR](#step-2--set-up-amazon-ecr)
7. [Step 3 — Create ECS Cluster and Service](#step-3--create-ecs-cluster-and-service)
8. [Step 4 — Configure AWS CodeBuild](#step-4--configure-aws-codebuild)
9. [Step 5 — Configure AWS CodeDeploy](#step-5--configure-aws-codedeploy)
10. [Step 6 — Create the CodePipeline](#step-6--create-the-codepipeline)
11. [Step 7 — Add Monitoring & Alerts](#step-7--add-monitoring--alerts)
12. [Configuration File Reference](#configuration-file-reference)
13. [IAM Permissions Reference](#iam-permissions-reference)
14. [Troubleshooting](#troubleshooting)
15. [Rubric Checklist](#rubric-checklist)

---

## 1. Project Overview

This project demonstrates a **production-grade, fully automated CI/CD pipeline** on AWS. Every `git push` to the main branch triggers:

1. **Source** — CodePipeline detects the change in GitHub.
2. **Build** — CodeBuild installs dependencies, runs unit tests, builds a Docker image, and pushes it to ECR.
3. **Approval** — A manual gate must be passed before promoting to production.
4. **Deploy** — CodeDeploy performs a Blue/Green deployment to an ECS Fargate cluster behind an Application Load Balancer.
5. **Monitor** — CloudWatch alarms and SNS email notifications track pipeline and service health.

---

## 2. Architecture

```
┌──────────────┐     webhook      ┌─────────────────────────────────────────────────────────┐
│   Developer  │ ──────────────▶  │                    AWS CodePipeline                     │
│  git push    │                  │                                                         │
└──────────────┘                  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────┐ │
                                  │  │  Source  │─▶│   Build   │─▶│ Approval │─▶│Deploy │ │
                                  │  │ (GitHub) │  │(CodeBuild)│  │ (Manual) │  │ (ECS) │ │
                                  │  └──────────┘  └─────┬─────┘  └──────────┘  └───┬───┘ │
                                  └────────────────────── │ ──────────────────────── │ ────┘
                                                          │                          │
                                                    ┌─────▼──────┐          ┌───────▼──────┐
                                                    │ Amazon ECR │          │  ECS Fargate │
                                                    │ (Docker    │          │  + ALB       │
                                                    │  Registry) │          │  Blue/Green  │
                                                    └────────────┘          └──────────────┘
                                                                                    │
                                                                         ┌──────────▼──────────┐
                                                                         │ CloudWatch + SNS     │
                                                                         │ (Alarms & Alerts)    │
                                                                         └─────────────────────┘
```

---

## 3. Prerequisites

Before you begin, make sure you have the following in place.

| Requirement | Details |
|---|---|
| AWS Account | With admin or sufficiently scoped IAM permissions |
| AWS CLI | Installed and configured (`aws configure`) |
| Docker | Installed locally for optional local testing |
| GitHub Account | Repository created and ready |
| Node.js ≥ 16 | For local development and testing |
| Git | Installed locally |

> **Tip:** Run `aws sts get-caller-identity` to confirm your CLI credentials are working before starting.

---

## 4. Repository Structure

```
capstone-project2/
├── src/
│   ├── app.js              # Express.js application entry point
│   ├── package.json        # Node.js dependencies and scripts
│   └── package-lock.json   # Locked dependency versions
├── tests/
│   └── app.test.js         # Jest unit tests
├── Dockerfile              # Container build instructions
├── buildspec.yml           # CodeBuild build instructions
├── appspec.yml             # CodeDeploy deployment instructions
├── taskdef.json            # ECS Task Definition template
└── README.md               # This file
```

---

## Step 1 — Prepare the Application Code

### 1.1 Create the project directory

```bash
mkdir capstone-project2 && cd capstone-project2
mkdir src tests
```

### 1.2 Create the application — `src/app.js`

```javascript
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from AWS CI/CD Capstone Project!');
});

app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
```

### 1.3 Create `src/package.json`

```json
{
  "name": "capstone-project2",
  "version": "1.0.0",
  "main": "app.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node app.js",
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.6.1"
  }
}
```

### 1.4 Create `tests/app.test.js`

```javascript
test('sample arithmetic test', () => {
  expect(2 + 2).toBe(4);
});
```

### 1.5 Create the `Dockerfile`

```dockerfile
FROM node:16

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 1.6 Test locally (optional but recommended)

```bash
cd src
npm install
npm test          # Run unit tests
npm start         # Verify app starts on port 3000

# Optional Docker test
docker build -t capstone-project2:local .
docker run -p 3000:3000 capstone-project2:local
# Visit http://localhost:3000
```

### 1.7 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Add app, Dockerfile, and tests"
git remote add origin https://github.com/<your-username>/capstone-project2.git
git push -u origin main
```

---

## Step 2 — Set Up Amazon ECR

Amazon ECR is the Docker registry where CodeBuild will push your images.

### 2.1 Create the ECR repository

```bash
aws ecr create-repository --repository-name capstone-project2-repo --region us-east-1
```


--->To Remove
URI: 508471420037.dkr.ecr.us-east-1.amazonaws.com/capstone-project2-repo


Note the `repositoryUri` from the output — it follows this pattern:

```
<account_id>.dkr.ecr.<region>.amazonaws.com/capstone-project2-repo
```

### 2.2 Verify the repository exists

```bash
aws ecr describe-repositories --repository-names capstone-project2-repo
```

### 2.3 (Optional) Test pushing an image locally

```bash
# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account_id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker build -t capstone-project2-repo .
docker tag capstone-project2-repo:latest \
  <account_id>.dkr.ecr.us-east-1.amazonaws.com/capstone-project2-repo:latest
docker push \
  <account_id>.dkr.ecr.us-east-1.amazonaws.com/capstone-project2-repo:latest
```

---

## Step 3 — Create ECS Cluster and Service

### 3.1 Create the ECS cluster (Fargate)

In the AWS Console:

1. Go to **ECS → Clusters → Create Cluster**.
2. Choose **AWS Fargate (serverless)**.
3. Name it `capstone-project2-cluster`.
4. Click **Create**.

Or via CLI:

```bash
aws ecs create-cluster --cluster-name capstone-project2-cluster
```

### 3.2 Create the Application Load Balancer

1. Go to **EC2 → Load Balancers → Create Load Balancer**.
2. Choose **Application Load Balancer**.
3. Name: `capstone-project2-alb`.
4. Scheme: **Internet-facing**.
5. Listeners: Port **80** (HTTP).
6. Add at least 2 public subnets.
7. Create a security group allowing inbound HTTP (port 80) from `0.0.0.0/0`.
8. Create a **Target Group**:
   - Target type: **IP**
   - Protocol: **HTTP**, Port: **3000**
   - Health check path: `/`
9. Register no targets yet — ECS will manage this.

### 3.3 Create the ECS Task Definition

1. Go to **ECS → Task Definitions → Create new Task Definition**.
2. Choose **Fargate**.
3. Configure:
   - Family name: `capstone-project2-task`
   - Task role: `ecsTaskExecutionRole`
   - Network mode: `awsvpc`
   - CPU: `0.25 vCPU (256)`
   - Memory: `0.5 GB (512)`
4. Add container:
   - Name: `capstone-project2-container`
   - Image: `<account_id>.dkr.ecr.us-east-1.amazonaws.com/capstone-project2-repo:latest`
   - Port mappings: `3000 / TCP`
5. Click **Create**.

### 3.4 Create the ECS Service

1. Go to your cluster → **Services → Create**.
2. Launch type: **Fargate**.
3. Task Definition: `capstone-project2-task` (latest revision).
4. Service name: `capstone-project2-service`.
5. Number of tasks: `1`.
6. VPC: select your VPC, at least 2 subnets.
7. Load balancer: select `capstone-project2-alb`, listener port 80, target group created above.
8. Deployment type: **Blue/green deployment (powered by AWS CodeDeploy)**.  
   _(This creates a CodeDeploy application automatically.)_
9. Click **Create Service**.

---

## Step 4 — Configure AWS CodeBuild

### 4.1 Create `buildspec.yml` in project root

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws --version
      - $(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)
      - REPOSITORY_URI=<account_id>.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/capstone-project2-repo
      - IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)

  build:
    commands:
      - echo Build started on `date`
      - cd src
      - npm install
      - npm test
      - cd ..
      - echo Building the Docker image...
      - docker build -t $REPOSITORY_URI:$IMAGE_TAG .

  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing the Docker image...
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"capstone-project2-container","imageUri":"%s"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json

artifacts:
  files: imagedefinitions.json
```

> **Replace** `<account_id>` with your actual AWS account ID.

### 4.2 Create the CodeBuild project in AWS Console

1. Go to **CodeBuild → Build Projects → Create build project**.
2. Project name: `capstone-project2-build`.
3. Source: **GitHub** → Connect your account → Select your repository.
4. Environment:
   - Managed image: **Ubuntu**
   - Runtime: **Standard**
   - Image: `aws/codebuild/standard:7.0`
   - Privileged: **✅ Enable** (required for Docker builds)
5. Service role: Create a new role (or attach an existing one with ECR push permissions).
6. Buildspec: **Use a buildspec file** → leave path as `buildspec.yml`.
7. Artifacts: **No artifacts** (CodePipeline manages artifact passing).
8. Click **Create build project**.

### 4.3 Grant CodeBuild permissions to push to ECR

Attach this inline policy to the CodeBuild IAM role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Step 5 — Configure AWS CodeDeploy

### 5.1 Create `appspec.yml` in project root

```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: "<TASK_DEFINITION>"
        LoadBalancerInfo:
          ContainerName: "capstone-project2-container"
          ContainerPort: 3000
```

> CodePipeline replaces `<TASK_DEFINITION>` automatically at deploy time.

### 5.2 Create `taskdef.json` in project root

```json
{
  "family": "capstone-project2-task",
  "networkMode": "awsvpc",
  "containerDefinitions": [
    {
      "name": "capstone-project2-container",
      "image": "<IMAGE_NAME>",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<account_id>:role/ecsTaskExecutionRole"
}
```

> The `<IMAGE_NAME>` placeholder is replaced by CodePipeline during the deploy stage using the `imagedefinitions.json` artifact.

### 5.3 Verify CodeDeploy application exists

When you created the ECS service with Blue/Green deployment in Step 3.4, AWS automatically created a CodeDeploy application. Verify:

```bash
aws deploy list-applications
# Should list: AppECS-capstone-project2-cluster-capstone-project2-service
```

If it was not created, create it manually:

1. Go to **CodeDeploy → Applications → Create application**.
2. Application name: `capstone-project2-codedeploy`.
3. Compute platform: **Amazon ECS**.
4. Create a deployment group pointing to your ECS cluster and service.

---

## Step 6 — Create the CodePipeline

### 6.1 Open CodePipeline

Go to **AWS CodePipeline → Pipelines → Create pipeline**.

### 6.2 Pipeline settings

- Pipeline name: `capstone-project2-pipeline`
- Service role: Create a new role
- Artifact store: Default S3 bucket (auto-created)

### 6.3 Stage 1 — Source

- Source provider: **GitHub (Version 2)**
- Connect to GitHub: follow the OAuth connection wizard
- Repository: your `capstone-project2` repository
- Branch: `main`
- Detection option: **GitHub webhooks**

### 6.4 Stage 2 — Build

- Build provider: **AWS CodeBuild**
- Region: your region
- Project name: `capstone-project2-build`
- Build type: **Single build**

### 6.5 Stage 3 — Approval (Manual Gate)

- Click **Add stage** → name it `Approval`
- Add action: **Manual approval**
- Action name: `ManualApproval`
- SNS topic ARN: (optional — enter the SNS topic created in Step 7 for email notification)
- Comments: `Please review the build artifacts before deploying to production.`

### 6.6 Stage 4 — Deploy

- Deploy provider: **Amazon ECS (Blue/Green)**
- Region: your region
- Application name: `AppECS-capstone-project2-cluster-capstone-project2-service`
- Deployment group: the group attached to `capstone-project2-service`
- Amazon ECS task definition: **BuildArtifact** → `taskdef.json`
- AWS CodeDeploy AppSpec file: **BuildArtifact** → `appspec.yml`
- Dynamically update task definition image:
  - Input artifact: `BuildArtifact`
  - Placeholder text in task definition: `<IMAGE_NAME>`

### 6.7 Review and create

Click **Create pipeline**. CodePipeline will run immediately for the first time.

---

## Step 7 — Add Monitoring & Alerts

### 7.1 Create an SNS topic for notifications

```bash
aws sns create-topic --name capstone-project2-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:<account_id>:capstone-project2-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

Check your inbox and confirm the subscription.

### 7.2 Create a CloudWatch alarm for ECS service health

Monitor running task count — alarm if it drops below 1:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "capstone-project2-ECS-NoRunningTasks" \
  --alarm-description "Alert when ECS running task count drops to 0" \
  --metric-name RunningTaskCount \
  --namespace AWS/ECS \
  --dimensions Name=ClusterName,Value=capstone-project2-cluster Name=ServiceName,Value=capstone-project2-service \
  --statistic Average \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator LessThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account_id>:capstone-project2-alerts \
  --treat-missing-data breaching
```

### 7.3 Create a CloudWatch alarm for CodePipeline failures

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "capstone-project2-Pipeline-Failed" \
  --alarm-description "Alert when CodePipeline execution fails" \
  --metric-name FailedPipelineExecutions \
  --namespace AWS/CodePipeline \
  --dimensions Name=PipelineName,Value=capstone-project2-pipeline \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions arn:aws:sns:us-east-1:<account_id>:capstone-project2-alerts \
  --treat-missing-data notBreaching
```

### 7.4 Verify monitoring in the console

- Go to **CloudWatch → Alarms** and confirm both alarms appear in OK state.
- Go to **SNS → Topics → capstone-project2-alerts → Subscriptions** and confirm your email is `Confirmed`.

---

## Configuration File Reference

### buildspec.yml — Full breakdown

| Phase | Purpose |
|---|---|
| `pre_build` | Authenticates Docker with ECR, sets image URI and tag variables |
| `build` | Installs npm deps, runs Jest tests, builds Docker image |
| `post_build` | Pushes image to ECR, writes `imagedefinitions.json` for CodePipeline |
| `artifacts` | Exports `imagedefinitions.json` to pass to the Deploy stage |

### appspec.yml — Full breakdown

| Field | Purpose |
|---|---|
| `TaskDefinition` | Placeholder replaced by CodePipeline with the new task definition ARN |
| `ContainerName` | Must exactly match the container name in `taskdef.json` |
| `ContainerPort` | Must match the port your app listens on |

### taskdef.json — Placeholders to replace

| Placeholder | Replace with |
|---|---|
| `<IMAGE_NAME>` | Your ECR image URI (managed dynamically by CodePipeline) |
| `<account_id>` | Your 12-digit AWS account ID |

---

## IAM Permissions Reference

| Role | Required Permissions |
|---|---|
| CodeBuild service role | ECR push, S3 read/write, CloudWatch Logs |
| CodeDeploy service role | ECS full access, ELB access, S3 read |
| CodePipeline service role | CodeBuild, CodeDeploy, S3, SNS, ECS |
| ECS Task Execution role | ECR pull, CloudWatch Logs write |

> All roles are created automatically if you let the console wizard create them. Review and tighten permissions before production use.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| CodeBuild fails: `Cannot connect to Docker daemon` | Privileged mode not enabled | Edit build project → enable **Privileged** flag |
| CodeBuild fails: `authorization token has expired` | Old ECR login command | Use `aws ecr get-login-password` (not `get-login`) in pre_build |
| CodeDeploy fails: `The deployment group does not exist` | ECS service not set to Blue/Green | Recreate service with Blue/Green deployment type |
| Pipeline stuck at Approval | No approver action taken | Go to Pipeline → click **Review** on the Approval stage |
| ECS tasks keep stopping | App crashes on startup | Check ECS task logs in CloudWatch → `/ecs/capstone-project2-task` |
| ALB returns 502 Bad Gateway | Container not listening on port 3000 | Confirm `EXPOSE 3000` in Dockerfile and app binds to `0.0.0.0` |
| ECR push denied | CodeBuild role missing ECR permissions | Attach ECR push policy to the CodeBuild IAM role |

---

## Rubric Checklist

Use this checklist to verify your submission meets all rubric criteria before submitting.

### Application, Repository & Containerization (25 pts)

- [ ] `src/app.js` — Express app returning a response on `/`
- [ ] `src/package.json` — dependencies and test script defined
- [ ] `tests/app.test.js` — at least one passing Jest test
- [ ] `Dockerfile` — app builds and runs in a container
- [ ] `README.md` — this file, complete and clear

### CI/CD Pipeline Implementation (25 pts)

- [ ] `buildspec.yml` — installs, tests, builds Docker image, pushes to ECR
- [ ] `imagedefinitions.json` — generated and exported as artifact
- [ ] CodeBuild project — runs tests before building image
- [ ] CodePipeline — Source → Build stages connected and passing
- [ ] ECR repository — images visible after successful build

### Deployment & Infrastructure (30 pts)

- [ ] ECS cluster (`capstone-project2-cluster`) created with Fargate
- [ ] ECS service (`capstone-project2-service`) running at least 1 task
- [ ] Application Load Balancer serving traffic on port 80
- [ ] `appspec.yml` and `taskdef.json` present and correctly configured
- [ ] CodeDeploy Blue/Green deployment configured
- [ ] Pipeline Deploy stage triggers ECS rolling Blue/Green update
- [ ] App accessible via ALB DNS name in browser

### Monitoring, Governance & Documentation (20 pts)

- [ ] CloudWatch alarm for ECS task count
- [ ] CloudWatch alarm for pipeline failures
- [ ] SNS topic with confirmed email subscription
- [ ] Manual Approval stage present in CodePipeline before Deploy
- [ ] `pipeline-diagram.png` added to repository root
- [ ] README covers all setup steps clearly

---

## Quick Reference — Key AWS Resources

After completing setup, record your resource identifiers here:

```
ECR Repository URI : <account_id>.dkr.ecr.<region>.amazonaws.com/capstone-project2-repo
ECS Cluster Name   : capstone-project2-cluster
ECS Service Name   : capstone-project2-service
ALB DNS Name       : capstone-project2-alb-<id>.<region>.elb.amazonaws.com
CodePipeline Name  : capstone-project2-pipeline
SNS Topic ARN      : arn:aws:sns:<region>:<account_id>:capstone-project2-alerts
```

Visit the ALB DNS name in your browser — you should see:

```
Hello from AWS CI/CD Capstone Project!
```

---

*Built for the AWS CI/CD Capstone Project. Every `git push` to `main` automatically builds, tests, and deploys your application.*