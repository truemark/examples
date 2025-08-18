import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as backup from "aws-cdk-lib/aws-backup";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";

/**
 * Stack props for our Aurora DR backup
 */
export interface CdkDbbackupStackProps extends cdk.StackProps {
  /** ARN of the Aurora DB Cluster to back up */
  readonly clusterArn: string;
}

export class CdkDbbackupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkDbbackupStackProps) {
    super(scope, id, props);

    // 1) Reference or create primary backup vault named 'sql2babel-vault'
    // 1) Ensure primary backup vault named 'sql2babel-vault' exists (create if not)
    const primaryVault = new backup.BackupVault(this, "PrimaryVault", {
      backupVaultName: "sql2babel-vault",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 2) Reference or create service role 'AWSBackupDefaultServiceRole2'
    let backupRole: iam.IRole;
    backupRole = new iam.Role(this, "BackupServiceRole2", {
      roleName: "AWSBackupDefaultServiceRole2",
      assumedBy: new iam.ServicePrincipal("backup.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSBackupServiceRolePolicyForBackup",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSBackupServiceRolePolicyForRestores",
        ),
      ],
    });

    // 3) Define your backup plan
    const plan = new backup.BackupPlan(this, "Sql2BabelBackupPlan", {
      backupPlanName: "Sql2BabelHourlyDR",
      backupVault: primaryVault,
    });

    // 4) Add a daily backup rule at 03:00 UTC and configure lifecycle and DR copy
    const hourlyRule = new backup.BackupPlanRule({
      ruleName: "Sql2BabelHourlyBackupRule",
      // Schedule: Every hour
      scheduleExpression: events.Schedule.cron({ minute: "0" }), // Every hour at minute 0
      startWindow: cdk.Duration.hours(1), // Start window of 2 hours
      completionWindow: cdk.Duration.hours(2), // Completion window of 2 hours
      deleteAfter: cdk.Duration.days(7), // Retain primary snapshots for 7 days
      copyActions: [
        {
          destinationBackupVault: backup.BackupVault.fromBackupVaultArn(
            this,
            "DrVault",
            `arn:aws:backup:us-east-2:590183695615:backup-vault:test-vault`,
          ),
          deleteAfter: cdk.Duration.days(14),
        },
      ],
    });
    plan.addRule(hourlyRule);

    // 5) Protect the Aurora cluster
    plan.addSelection("Sql2BabelResourceAssignCluster", {
      // ARN for the Aurora cluster named 'sql2-babel-kyle-cluster'
      resources: [
        backup.BackupResource.fromArn(
          `arn:aws:rds:${this.region}:${this.account}:cluster:sql2-babel-kyle-cluster`,
        ),
      ],
      role: backupRole,
    });
  }
}
