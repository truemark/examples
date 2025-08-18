#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkDbbackupStack } from "../lib/cdk-dbbackup-stack";

const app = new cdk.App();
new CdkDbbackupStack(app, "CdkDbbackupStack", {
  clusterArn:
    process.env.CLUSTER_ARN! ||
    "arn:aws:rds:us-west-2:590183695615:cluster:sql2-babel-kyle-cluster",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
