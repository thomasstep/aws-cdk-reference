import * as path from 'path';

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';

export class GoApi extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const gatewayLogGroup = new logs.LogGroup(this, 'api-access-logs', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const restApi = new apigateway.RestApi(this, 'rest-api', {
      deploy: true,
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        accessLogDestination: new apigateway.LogGroupLogDestination(gatewayLogGroup),
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowCredentials: true,
      },
    });

    const lambdaFunction = new lambda.Function(this, 'golang-lambda', {
      handler: 'main', // Because the build output is called main
      runtime: lambda.Runtime.GO_1_X,
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset(path.join(__dirname, '../'), {
        bundling: {
          image: lambda.Runtime.GO_1_X.bundlingImage,
          user: "root",
          command: [
            'bash', '-c',
            'GOOS=linux GOARCH=amd64 go build -o /asset-output/main ./cmd/helloWorld'
          ]
        },
      }),
    });

    restApi.root.addMethod(
      'GET',
      new apigateway.LambdaIntegration(lambdaFunction, {}),
      {},
    );
  }
}
