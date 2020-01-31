import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import repo = require('@aws-cdk/aws-ecr');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import cert = require('@aws-cdk/aws-certificatemanager');
import route53 = require('@aws-cdk/aws-route53');
import codebuild = require('@aws-cdk/aws-codebuild');
import {PolicyStatement} from '@aws-cdk/aws-iam';
import codepipeline = require('@aws-cdk/aws-codepipeline');
import cpactions = require('@aws-cdk/aws-codepipeline-actions');

import events = require('@aws-cdk/aws-events');
import iam = require('@aws-cdk/aws-iam');
import {Construct} from '@aws-cdk/core';

export interface MyEcsDeployActionProps extends codepipeline.CommonAwsActionProps {
    readonly input: codepipeline.Artifact;
    readonly serviceName: string;
    readonly clusterName: string;
}

export class MyEcsDeployAction implements codepipeline.IAction {
    public readonly actionProperties: codepipeline.ActionProperties;
    private readonly props: MyEcsDeployActionProps;

    constructor(props: MyEcsDeployActionProps) {
        this.actionProperties = {
            ...props,
            category: codepipeline.ActionCategory.DEPLOY,
            provider: 'ECS',
            artifactBounds: {minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0},
            inputs: [props.input],
        };

        this.props = props;
    }

    // tslint:disable-next-line:variable-name
    public bind(_scope: Construct, _stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
        codepipeline.ActionConfig {
        // you probably need all these permissions
        options.role.addToPolicy(new iam.PolicyStatement({
            actions: [
                'ecs:DescribeServices',
                'ecs:DescribeTaskDefinition',
                'ecs:DescribeTasks',
                'ecs:ListTasks',
                'ecs:RegisterTaskDefinition',
                'ecs:UpdateService',
            ],
            resources: ['*'],
        }));

        options.role.addToPolicy(new iam.PolicyStatement({
            actions: ['iam:PassRole'],
            resources: ['*'],
            conditions: {
                StringEqualsIfExists: {
                    'iam:PassedToService': [
                        'ec2.amazonaws.com',
                        'ecs-tasks.amazonaws.com',
                    ],
                },
            },
        }));

        options.bucket.grantRead(options.role);

        return {
            configuration: {
                ClusterName: this.props.clusterName,
                ServiceName: this.props.serviceName,
                // FileName is imagedefinitions.json by default
            },
        };
    }

    public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule {
        throw new Error('Method not implemented.');
    }
}

export class CordApiV3Stack extends cdk.Stack {

    image: string = 'cord-api-v3';
    memory: number = 2048;
    cpu: number = 512;
    domain: string = 'cordapi3test.com';
    port: number = 3000;
    count: number = 1;
    lbport: number = 443;
    cert: string = 'cert';
    // tslint:disable-next-line:variable-name
    owner_github: string = 'user';
    // tslint:disable-next-line:variable-name
    secret_github: string = 'secret';
    branch: string = 'branch';

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, this.image + 'Vpc', {
            maxAzs: 2,
            natGateways: 1,
        });

        const cluster = new ecs.Cluster(this, this.image, {
            clusterName: this.image,
            vpc,
        });

        const loggingSvc1 = new ecs.AwsLogDriver({
            streamPrefix: this.image,
        });

        const taskDefSvc = new ecs.FargateTaskDefinition(this, this.image + 'Definition', {
            memoryLimitMiB: this.memory,
            cpu: this.cpu,
        });

        const containerSvc = taskDefSvc.addContainer(this.image, {
            image: ecs.ContainerImage.fromEcrRepository(repo.Repository.fromRepositoryName(this, this.image + 'Repo', this.image)),
            logging: loggingSvc1,
            environment: {
                NEO4J_URL: 'bolt://db',
                NEO4J_USERNAME: 'user',
                NEO4J_PASSWORD: 'pass',
                NODE_ENV: 'env',
            },
        });

        containerSvc.addPortMappings({
            containerPort: this.port,
        });

        const fsvc = new ecs_patterns.ApplicationLoadBalancedFargateService(this, this.image + 'Service', {
            serviceName: this.image,
            maxHealthyPercent: 0,
            cluster,
            desiredCount: this.count,
            publicLoadBalancer: true,
            protocol: elbv2.ApplicationProtocol.HTTPS,
            certificate: cert.Certificate.fromCertificateArn(this, this.image + 'Cert', this.cert),
            listenerPort: this.lbport,
            domainName: this.image,
            domainZone: route53.HostedZone.fromLookup(this, this.domain + this.image, {domainName: this.domain}),
            taskDefinition: taskDefSvc,
        });

        fsvc.targetGroup.configureHealthCheck({
            path: '/graphql',
            healthyHttpCodes: '200-499',
            healthyThresholdCount: 7,
            unhealthyThresholdCount: 5,
        });

        const project = new codebuild.PipelineProject(this, this.image + 'Project',
            {
                environment: {
                    computeType: codebuild.ComputeType.SMALL,
                    buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
                    privileged: true,
                },
            },
        );

        project.role?.addToPolicy(new PolicyStatement({
            resources: ['*'],
            actions: ['ecr:*'],
        }));

        const sourceOutput = new codepipeline.Artifact();

        const sourceAction = new cpactions.GitHubSourceAction({
            actionName: this.image + 'GitHubSource',
            owner: this.owner_github,
            repo: this.image,
            oauthToken: cdk.SecretValue.plainText(this.secret_github),
            output: sourceOutput,
            branch: this.branch,
            trigger: cpactions.GitHubTrigger.WEBHOOK,
        });

        const Output = new codepipeline.Artifact();

        const buildAction = new cpactions.CodeBuildAction({
            actionName: this.image + 'CodeBuild',
            project,
            input: sourceOutput,
            outputs: [Output],
        });

        const deployAction = new MyEcsDeployAction({
            actionName: this.image + 'Deploy',
            serviceName: this.image,
            clusterName: this.image,
            input: Output,
        });

        // tslint:disable-next-line:no-unused-expression
        new codepipeline.Pipeline(this, 'MyPipeline1', {
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [buildAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });
    }
}
