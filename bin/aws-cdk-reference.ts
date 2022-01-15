#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApiGatewaySnsIntegration } from '../lib/api-gateway-sns-integration';

const app = new cdk.App();
new ApiGatewaySnsIntegration(app, 'api-gateway-sns-integration', {});