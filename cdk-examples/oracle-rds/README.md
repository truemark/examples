# Oracle RDS with EC2 Application Server

This CDK project creates a complete Oracle Enterprise Edition RDS database infrastructure with an accompanying EC2 application server. The setup includes advanced Oracle features like S3 integration, custom parameter groups, and proper security configurations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VPC: services                            │
│                                                             │
│  ┌─────────────────┐              ┌─────────────────────┐   │
│  │   Private       │              │    Database         │   │
│  │   Subnets       │              │    Subnets          │   │
│  │                 │              │                     │   │
│  │  ┌───────────┐  │    Port      │  ┌───────────────┐  │   │
│  │  │    EC2    │  │    1521      │  │  Oracle RDS   │  │   │
│  │  │    App    │──┼──────────────┼─▶│   Database    │  │   │
│  │  │  Server   │  │              │  │   (oracle4)   │  │   │
│  │  └───────────┘  │              │  └───────────────┘  │   │
│  └─────────────────┘              └─────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   S3 Bucket     │
                    │  Data Archive   │
                    │ (590183695615-  │
                    │ data-archive)   │
                    └─────────────────┘
```

## Components

### Oracle RDS Stack (`OracleRdsStack`)
- **Database Engine**: Oracle Enterprise Edition 19.0.0.0.ru-2025-07.rur-2025-07.r1
- **Instance Type**: t3.medium
- **Storage**: GP3 with autoscaling (300GB → 1000GB)
- **License Model**: Bring Your Own License (BYOL)
- **Features**:
  - S3 integration for data archiving
  - Custom parameter group with recyclebin enabled
  - Timezone set to America/Denver
  - Custom option group with S3_INTEGRATION

### EC2 Application Stack (`AppEc2Stack`)
- **Instance Type**: t4g.micro (ARM64)
- **AMI**: ami-02c817a245be8f5c6 (us-west-2)
- **Placement**: Private subnets with SSM access
- **Features**:
  - Pre-configured SSH keys
  - SSM managed instance core
  - Security group allowing database connectivity

## Prerequisites

### Infrastructure Requirements
1. **Existing VPC** named "services" with:
   - Subnet groups tagged with `network` key
   - `database` subnet group (for RDS)
   - `private` subnet group (for EC2)

2. **S3 Bucket** for data archiving:
   - Bucket name: `590183695615-data-archive`
   - Must exist before deployment

3. **Oracle License**:
   - Valid Oracle Enterprise Edition license (BYOL model)
   - Ensure compliance with Oracle licensing terms

### AWS Account Configuration
- Target Account: `590183695615`
- Target Region: `us-west-2`
- Appropriate IAM permissions for CDK deployment

## Configuration

### Key Parameters (in `oracle-rds-stack.ts`)
```typescript
const dbName = 'oracle4';                    // Database identifier
const allocatedStorageGiB = 300;             // Initial storage
const maxAllocatedStorageGiB = 1000;         // Max autoscaling storage
const oracleFull = '19.0.0.0.ru-2025-07.rur-2025-07.r1';  // Full version
```

### Network Access
The database security group allows access on:
- **Port 1521**: Oracle database connections
- **Port 1140**: Application access
- **Port 3872**: Application access
- **Port 22**: SSH access

Access is restricted to corporate network (`10.0.0.0/8`).

## Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Deploy the Stacks
Deploy RDS stack first (required dependency):
```bash
npx cdk deploy OracleRdsStack
```

Then deploy the application stack:
```bash
npx cdk deploy AppEc2Stack
```

Or deploy both stacks together:
```bash
npx cdk deploy --all
```

### 4. Verify Deployment
Check the CloudFormation outputs for:
- Database endpoint
- EC2 instance ID
- Security group IDs
- S3 archive role ARN

## Post-Deployment

### Connecting to the Database
1. **From EC2 Instance**:
   ```bash
   # Connect via SSM Session Manager
   aws ssm start-session --target <instance-id>
   
   # Install Oracle client tools
   # Connect to database using endpoint from stack outputs
   ```

2. **Database Connection Details**:
   - **Host**: Use `DbEndpoint` from stack outputs
   - **Port**: 1521
   - **Database**: oracle4
   - **Credentials**: Set during RDS creation (check Secrets Manager)

### S3 Integration Usage
The database includes S3 integration for data archiving:
```sql
-- Example: Export data to S3
BEGIN
  DBMS_CLOUD.EXPORT_DATA(
    credential_name => 'S3_CRED',
    file_uri_list   => 's3://590183695615-data-archive/export/data.csv',
    query           => 'SELECT * FROM your_table'
  );
END;
/
```

## Security Considerations

### Network Security
- Database is not publicly accessible
- EC2 instance in private subnets
- Security groups restrict access to corporate network
- SSH access available from anywhere (consider restricting)

### IAM Permissions
- S3 integration role has minimal required permissions
- EC2 instance role includes SSM managed instance core
- Consider implementing least privilege principles

### Database Security
- Enable encryption at rest (add to stack if required)
- Implement proper backup retention policies
- Configure monitoring and alerting

## Cost Considerations

### Oracle Licensing
- **BYOL Model**: You must provide valid Oracle licenses
- **Instance vCPUs**: t3.medium = 2 vCPUs (license accordingly)
- **Scaling**: Monitor autoscaling to control license requirements

### AWS Costs
- **RDS Instance**: t3.medium (~$0.068/hour)
- **Storage**: GP3 pricing + autoscaling costs
- **EC2 Instance**: t4g.micro (free tier eligible)
- **Data Transfer**: Between AZs and to S3

## Troubleshooting

### Common Issues

1. **VPC Not Found**:
   - Ensure VPC named "services" exists
   - Verify subnet group tags are correct

2. **S3 Bucket Access**:
   - Confirm bucket `590183695615-data-archive` exists
   - Check IAM role permissions

3. **Database Connection**:
   - Verify security group rules
   - Check network ACLs
   - Confirm Oracle listener is running

4. **Stack Dependencies**:
   - Always deploy OracleRdsStack before AppEc2Stack
   - Check CloudFormation exports are available

### Useful Commands

```bash
# View stack outputs
npx cdk list
npx cdk diff

# Check synthesized CloudFormation
npx cdk synth

# Destroy stacks (careful with data!)
npx cdk destroy AppEc2Stack
npx cdk destroy OracleRdsStack
```

## Development Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run watch`   - Watch for changes and compile
* `npm run test`    - Perform Jest unit tests
* `npx cdk deploy`  - Deploy this stack to your default AWS account/region
* `npx cdk diff`    - Compare deployed stack with current state
* `npx cdk synth`   - Emit the synthesized CloudFormation template

## Tags

This infrastructure is tagged with:
- `automation:id`: oracle

## Support

For issues related to:
- **Oracle Database**: Consult Oracle documentation and support
- **AWS CDK**: Check AWS CDK documentation
- **Infrastructure**: Review CloudFormation events and logs
