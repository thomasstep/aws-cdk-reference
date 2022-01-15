import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSub from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';

const inlineCode = new lambda.InlineCode(`exports.handler = async function (event, context, callback) {
  try {
    event.Records.forEach((record) => {
      const {
        Sns: {
          Message: stringifiedMessage,
        },
      } = record;
      const message = JSON.parse(stringifiedMessage);
      console.log(message);
    });
  } catch (uncaughtError) {
    console.error(uncaughtError);
    throw uncaughtError;
  }
}`);

export class ApiGatewaySnsIntegration extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // API Gateway creation
    const api = new apigateway.RestApi(this, 'api', {});

    // SNS creation
    const topic = new sns.Topic(this, 'topic');

    // API Gateway and SNS integration
    const apiGatewayRole = new iam.Role(this, 'integration-role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    topic.grantPublish(apiGatewayRole);
    const attributeValue = 'someValue';
    api.root.addMethod(
      'POST',
      new apigateway.AwsIntegration({
        service: 'sns',
        path: '/',
        integrationHttpMethod: 'POST',
        options: {
          credentialsRole: apiGatewayRole,
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          requestParameters: {
            'integration.request.header.Content-Type': "'application/x-www-form-urlencoded'"
          },
          requestTemplates: {
            'application/json': `Action=Publish&TopicArn=$util.urlEncode(\'${topic.topicArn}\')\
&Message=$util.urlEncode('{"someParam":"')$input.params('paramName')$util.urlEncode('"}')\
&MessageAttributes.entry.1.Name=myAttribute\
&MessageAttributes.entry.1.Value.DataType=String\
&MessageAttributes.entry.1.Value.StringValue=${attributeValue}`,
          },
          integrationResponses: [
            {
              statusCode: "202",
              responseTemplates: {
                'application/json': '{}',
              },
            },
            {
              statusCode: "500",
              // Anything but a 2XX response
              selectionPattern: "(1|3|4|5)\d{2}",
              responseTemplates: {
                'application/json': '{}',
              },
            },
          ],
        },
      }),
      {
        methodResponses: [
          {
            statusCode: "202",
            responseModels: {
              'application/json': apigateway.Model.EMPTY_MODEL,
            },
          },
          {
            statusCode: "500",
            responseModels: {
              'application/json': apigateway.Model.EMPTY_MODEL,
            },
          },
        ],
      },
    );

    // Lambda creation and subscription
    const dlq = new sqs.Queue(this, 'lambda-dlq', {});
    const lambdaFunction = new lambda.Function(
      this,
      'function',
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: inlineCode,
        handler: 'index.handler',
        deadLetterQueue: dlq,
      },
    );
    topic.addSubscription(new snsSub.LambdaSubscription(
      lambdaFunction,
      {
        filterPolicy: {
          myAttribute: sns.SubscriptionFilter.stringFilter({
            allowlist: [attributeValue],
          }),
        },
      }
    ));
  }
}
