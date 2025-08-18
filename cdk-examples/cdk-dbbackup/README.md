# CDK Database Backup Infrastructure

This CDK project provisions AWS infrastructure for automated Aurora database backup with cross-region disaster recovery. It creates AWS Backup resources to protect Aurora clusters with hourly backups and cross-region replication.

## Overview

The `cdk-dbbackup` stack provides:
- Hourly automated Aurora database backups using AWS Backup
- Cross-region disaster recovery with automated vault copying
- IAM service roles for backup operations
- Configurable retention policies (7 days primary, 14 days DR)
- Aurora cluster resource protection

## Architecture

The stack deploys:
- **AWS Backup Vault**: Primary backup storage (`sql2babel-vault`)
- **Backup Plan**: Hourly backup schedule with lifecycle management
- **Cross-Region Copy**: Disaster recovery backups to `us-east-2` region
- **IAM Service Role**: `AWSBackupDefaultServiceRole2` with necessary permissions
- **Resource Selection**: Targets specific Aurora cluster for protection

## Prerequisites

- **Node.js**: Version 18.x or later
- **AWS CLI**: Configured with appropriate credentials and permissions
- **CDK CLI**: Version 2.x
- **TypeScript**: For development
- **test-vault vault**: Required prerequisite in the `us-east-2` region

## Environment Variables

- `CLUSTER_ARN`: (Optional) ARN of the Aurora cluster to backup
- `CDK_DEFAULT_ACCOUNT`: AWS account ID for deployment
- `CDK_DEFAULT_REGION`: Primary AWS region for deployment

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Bootstrap CDK** (first time only):
   ```bash
   npx cdk bootstrap
   ```

## Deployment

1. **Deploy the stack**:
   ```bash
   npx cdk deploy
   ```

2. **View the deployment**:
   ```bash
   npx cdk ls
   ```

## Configuration

The stack is configured to backup the Aurora cluster `sql2-babel-kyle-cluster` by default. To backup a different cluster, set the `CLUSTER_ARN` environment variable:

```bash
export CLUSTER_ARN="arn:aws:rds:us-west-2:123456789012:cluster:my-cluster"
npx cdk deploy
```

## Backup Schedule

- **Frequency**: Hourly (at minute 0 of each hour)
- **Start Window**: 1 hour
- **Completion Window**: 2 hours
- **Primary Retention**: 7 days
- **DR Retention**: 14 days (copied to `us-east-2`)

## Useful Commands

- `npm run build`: Compile TypeScript to JavaScript
- `npm run watch`: Watch for changes and compile
- `npm run test`: Run the test suite
- `npx cdk deploy`: Deploy this stack to your default AWS account/region
- `npx cdk diff`: Compare deployed stack with current state
- `npx cdk synth`: Emit the synthesized CloudFormation template

## Testing

Run the test suite:
```bash
npm test
```

## Stack Resources

- **Backup Vault**: `sql2babel-vault` (retained on deletion)
- **Backup Plan**: `Sql2BabelHourlyDR`
- **IAM Role**: `AWSBackupDefaultServiceRole2`
- **Target Resource**: Aurora cluster specified by `clusterArn` prop