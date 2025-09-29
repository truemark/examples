import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AppEc2Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, 'MainVpc', {
            tags: { Name: 'services' },
            subnetGroupNameTag: 'network',
        });

        const appSg = new ec2.SecurityGroup(this, 'AppSg', {
            vpc,
            allowAllOutbound: true,
            description: 'App server SG',
        });

        // Inbound SSH rules to match your table:
        // IPv4: 0.0.0.0/0, TCP 22
        appSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
        // IPv6: ::/0, TCP 22  (requires VPC to have IPv6 CIDR associated)
        appSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(22));

        const role = new iam.Role(this, 'AppInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        });
        role.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
        );

        // Fixed ARM64 AMI
        const ami = ec2.MachineImage.genericLinux({ 'us-west-2': 'ami-02c817a245be8f5c6' });

        const sshKeys = [
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDl+CZNejqgctLoRkq7VQoQ4ozi/9Em4j7OZwcaBZhl9SZfYoVfoS+GNDJZAnkKJUjMetCtnJtbqPAELkg64HSgxm0CMR4h/QBKyYwp7u6kq0iDQOpJN/9RKndvIgDGT+uJAcxs1NBCHJ8LubJw+yF3zjfCgqCRzEm6jjnJa1rGSRjyqwG7BofIxoqKIgM7tszNkz+pzeJIoo2Oz0+jQ9gBrWtW6Ncd0Clswu1xk8O+jLSf5bt7Ig+5uKvrLzFsZ/6JD9GFu9d5mYP3NMOhXzN++VuRn7R5TMG/n0Y6LysLPG2eImUIU1PAmpH6CBRITthHtMr3+e9bU2N6ZGGtsExj erikrj@krennic",
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDNri/BJiB8gC7ctpHKMerqLHyqL8sbx4Cfk9lUJWXShokS0pd5sRuDwb7kaRaAt1pdgpsTBAYI6lDHczDGxOifGfMSVoskizFYHxxx/Szaivlvhl2oqxewpqHc8k+qEmRnmrVj4bqLeDtxzbU9m9dZpCp1lZJ531YRwVv8FCL4Bgge1XyrHg92efRULFNCYY05MoDYMg/3luh07DeY/g/VEPcLGYuJyxJcg5vOyxqEzlXecCR4GyZeuh2Wr64C9qZmaAFUEGbu3PByrQJmJVRoVat99XIdHbSaOBaaunAcEH858vt3Bdi56CYNx58zrQK5Lc1xvADAb+OCl3eTJUhTyCtsO5likWRblBg8DmhF0e3yujNOCqqwqPVQt8BWOe1PZUCNsgq53dNiHlfRxOHd1S4F/RT14qs9Zfjp9ITMRstaZ0m8qSakc/Zb4vV2ez0eJn+mQJKN5qp9PPeqQrf7+QuQeZo+iZx8wMRphrKaR9M+CxD1FJoU7nZ9rGLufnM= kstephenson@KYLEs-MacBook-Pro.local",
        ];

        const userData = ec2.UserData.forLinux();
        userData.addCommands(
            'mkdir -p /home/ec2-user/.ssh',
            'chmod 700 /home/ec2-user/.ssh',
            ...sshKeys.map((k) => `echo "${k}" >> /home/ec2-user/.ssh/authorized_keys`),
            'chmod 600 /home/ec2-user/.ssh/authorized_keys',
            'chown -R ec2-user:ec2-user /home/ec2-user/.ssh'
        );

        const instance = new ec2.Instance(this, 'AppInstance', {
            vpc,
            vpcSubnets: { subnetGroupName: 'private' }, // has egress for SSM/yum
            securityGroup: appSg,
            role,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            machineImage: ami,
            userData,
        });

        // Import DB SG from the RDS stack and allow app → DB on 1521
        const dbSgId = cdk.Fn.importValue('OracleDbSgId');
        const dbSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'ImportedDbSg', dbSgId);
        dbSg.addIngressRule(appSg, ec2.Port.tcp(1521), 'App to Oracle 1521');

        new cdk.CfnOutput(this, 'AppInstanceId', { value: instance.instanceId });
        new cdk.CfnOutput(this, 'AppInstanceRoleName', { value: role.roleName });
    }
}