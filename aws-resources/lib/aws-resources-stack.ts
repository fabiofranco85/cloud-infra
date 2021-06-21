import * as cdk from '@aws-cdk/core';
import {SecretValue} from '@aws-cdk/core';
import {CdkPipeline, SimpleSynthAction} from '@aws-cdk/pipelines';
import {Artifact} from '@aws-cdk/aws-codepipeline';
import {GitHubSourceAction} from '@aws-cdk/aws-codepipeline-actions';
import {StringParameter} from '@aws-cdk/aws-ssm';
import {EksClusterStage} from 'eks-for-prod';
import {BuildEnvironmentVariableType} from '@aws-cdk/aws-codebuild';

export class AwsResourcesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceArtifact = new Artifact();
    const cloudAssemblyArtifact = new Artifact();

    const repo = StringParameter.valueFromLookup(this, '/cdk/aws-resources/github/repo');
    const owner = StringParameter.valueFromLookup(this, '/cdk/aws-resources/github/owner');
    const branch = StringParameter.valueFromLookup(this, '/cdk/aws-resources/github/branch');
    const subdirectory = StringParameter.valueFromLookup(this, '/cdk/aws-resources/github/subdirectory');
    const oauthToken = SecretValue.secretsManager('/cdk/aws-resources/github/token');

    const pipeline = new CdkPipeline(this, 'ResourcesPipeline', {
      cloudAssemblyArtifact,

      sourceAction: new GitHubSourceAction({
        actionName: 'GitHubAction',
        output: sourceArtifact,
        oauthToken,
        repo,
        owner,
        branch
      }),

      synthAction: SimpleSynthAction.standardNpmSynth({
        cloudAssemblyArtifact,
        sourceArtifact,
        subdirectory: subdirectory || undefined,
        environmentVariables: {
          CDK_DEFAULT_ACCOUNT: {
            type: BuildEnvironmentVariableType.PLAINTEXT,
            value: process.env.CDK_DEFAULT_ACCOUNT
          },
          CDK_DEFAULT_REGION: {
            type: BuildEnvironmentVariableType.PLAINTEXT,
            value: process.env.CDK_DEFAULT_REGION
          }
        }
      })
    });

    pipeline.addApplicationStage(new EksClusterStage(this, 'EksClusterStage'));
  }
}
