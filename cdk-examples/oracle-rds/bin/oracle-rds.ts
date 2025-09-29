#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OracleRdsStack } from '../lib/oracle-rds-stack';
import { AppEc2Stack } from '../lib/app-ec2-stack';

const app = new cdk.App();

const rdsStack = new OracleRdsStack(app, 'OracleRdsStack', {
    env: { account: '590183695615', region: 'us-west-2' },
});

const appStack = new AppEc2Stack(app, 'AppEc2Stack', {
    env: { account: '590183695615', region: 'us-west-2' },
});

// Ensure exports exist before imports
appStack.addDependency(rdsStack);