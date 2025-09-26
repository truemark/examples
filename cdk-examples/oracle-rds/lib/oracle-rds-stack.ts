import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class OracleRdsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, {
            ...props,
            env: { ...props?.env, region: 'us-west-2' },
        });

        // ---------- Config ----------
        const dbName = 'oracle2';
        const allocatedStorageGiB = 300;
        const maxAllocatedStorageGiB = 1000; // turns on autoscaling
        // Full RU/RUR for the DB instance:
        const oracleFull = rds.OracleEngineVersion.of(
            '19',
            '19.0.0.0.ru-2025-07.rur-2025-07.r1'
        );
        // Major version only for Param/Option groups:
        const oracleMajor = rds.OracleEngineVersion.VER_19;
        // ----------------------------

        // VPC from tags; subnets selected by custom tag key "network"
        const vpc = ec2.Vpc.fromLookup(this, 'MainVpc', {
            tags: { Name: 'services' },
            subnetGroupNameTag: 'network',
        });

        const dbSubnets: ec2.SubnetSelection = {
            subnetGroupName: 'database',
            onePerAz: true,
        };

        // Security Group
        const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
            vpc,
            allowAllOutbound: true,
            description: `RDS SG for ${dbName}`,
            securityGroupName: `${dbName}`,
        });
        cdk.Tags.of(dbSg).add('Name', `${dbName}`);

        // Ingress rules (10.0.0.0/8)
        const corpCidr = ec2.Peer.ipv4('10.0.0.0/8');
        dbSg.addIngressRule(corpCidr, ec2.Port.tcp(1521), 'Allow Oracle DB access');
        dbSg.addIngressRule(corpCidr, ec2.Port.tcp(1140), 'Allow application access on 1140');
        dbSg.addIngressRule(corpCidr, ec2.Port.tcp(22),   'Allow SSH access');
        dbSg.addIngressRule(corpCidr, ec2.Port.tcp(3872), 'Allow application access on 3872');

        // IAM role for S3 integration
        const archiveRole = new iam.Role(this, 'S3DataArchiveRole', {
            roleName: `s3-data-archive-${dbName}`,
            assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
            description: `RDS Oracle S3 integration role for ${dbName}`,
        });

        const archivePolicy = new iam.Policy(this, 'S3DataArchivePolicy', {
            policyName: `s3-data-archive-${dbName}`,
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        's3:PutObject',
                        's3:ListMultipartUploadParts',
                        's3:ListBucket',
                        's3:GetObjectVersion',
                        's3:GetObject',
                        's3:DeleteObject',
                        's3:AbortMultipartUpload',
                    ],
                    resources: [
                        'arn:aws:s3:::590183695615-data-archive/*',
                        'arn:aws:s3:::590183695615-data-archive',
                    ],
                }),
            ],
        });
        archiveRole.attachInlinePolicy(archivePolicy);

        // Parameter group (must use MAJOR version -> oracle-ee-19 family)
        const parameterGroup = new rds.ParameterGroup(this, 'CustomOracleParameterGroup', {
            engine: rds.DatabaseInstanceEngine.oracleEe({ version: oracleMajor }),
            parameters: { recyclebin: 'ON' },
        });

        // Option group (older CDK uses DatabaseInstanceEngine here; keep MAJOR version)
        const optionGroup = new rds.OptionGroup(this, 'OracleOptionGroup', {
            engine: rds.DatabaseInstanceEngine.oracleEe({ version: oracleMajor }),
            configurations: [
                { name: 'S3_INTEGRATION', version: '1.0' },
                { name: 'Timezone', settings: { TIME_ZONE: 'America/Denver' } },
            ],
        });

        // RDS instance (pin to FULL RU/RUR; GP3 + autoscaling)
        const database = new rds.DatabaseInstance(this, 'OracleDatabase', {
            engine: rds.DatabaseInstanceEngine.oracleEe({ version: oracleFull }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),

            databaseName: dbName,
            instanceIdentifier: dbName,

            storageType: rds.StorageType.GP3,
            allocatedStorage: allocatedStorageGiB,
            maxAllocatedStorage: maxAllocatedStorageGiB, // enables autoscaling

            licenseModel: rds.LicenseModel.BRING_YOUR_OWN_LICENSE,
            autoMinorVersionUpgrade: false,
            deletionProtection: false,
            deleteAutomatedBackups: true,
            publiclyAccessible: false,

            vpc,
            vpcSubnets: dbSubnets,
            securityGroups: [dbSg],

            parameterGroup,
            optionGroup,

            // Pure L2 association (shows under "Manage IAM roles")
            s3ExportRole: archiveRole,
            // s3ImportRole: archiveRole, // if you also import from S3
        });

        // Outputs
        new cdk.CfnOutput(this, 'SecurityGroupId', { value: dbSg.securityGroupId });
        new cdk.CfnOutput(this, 'DbEndpoint', { value: database.instanceEndpoint.hostname });
        new cdk.CfnOutput(this, 'S3ArchiveRoleArn', { value: archiveRole.roleArn });

        cdk.Tags.of(this).add('automation:id', 'oracle');
    }
}
