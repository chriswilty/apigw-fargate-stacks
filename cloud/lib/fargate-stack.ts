import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { Cluster, ContainerImage, PropagatedTagSource } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { join } from 'node:path';
import { appName, resourceName } from './resourceNamingUtils';

type FargateStackProps = StackProps & {
	webappUrl: string;
}

export class FargateStack extends Stack {
	public readonly loadBalancer: ApplicationLoadBalancer;
	public readonly vpc: Vpc;

	constructor(scope: Construct, id: string, props: FargateStackProps) {
		super(scope, id, props);

		const { webappUrl } = props;

		const generateResourceName = resourceName(scope);

		const dockerImageAsset = new DockerImageAsset(
			this,
			generateResourceName('container-image'),
			{
				directory: join(__dirname, '../../api/'),
			}
		);

		const containerPort = Number.parseInt(process.env.CONTAINER_PORT ?? '3000');
		const clusterName = generateResourceName('cluster');
		const fargateServiceName = generateResourceName('fargate');
		const loadBalancerName = generateResourceName('loadbalancer');
		const loadBalancerLogName = generateResourceName('loadbalancer-logs');
		const vpcName = generateResourceName('vpc');

		this.vpc = new Vpc(this, vpcName, { vpcName, maxAzs: 2 });

		// Create a private, application-load-balanced Fargate service
		const fargateService = new ApplicationLoadBalancedFargateService(
			this,
			fargateServiceName,
			{
				serviceName: fargateServiceName,
				cluster: new Cluster(this, clusterName, { clusterName, vpc: this.vpc }),
				cpu: 256, // Default is 256
				desiredCount: 1,
				taskImageOptions: {
					image: ContainerImage.fromDockerImageAsset(dockerImageAsset),
					containerPort,
					environment: {
						NODE_ENV: 'production',
						COOKIE_SID: `${appName}.sid`,
						CORS_ALLOW_ORIGIN: webappUrl,
						PORT: `${containerPort}`,
					},
				},
				memoryLimitMiB: 512, // Default is 512
				loadBalancerName,
				publicLoadBalancer: false,
				propagateTags: PropagatedTagSource.SERVICE,
			}
		);
		fargateService.targetGroup.configureHealthCheck({
			path: '/health',
		});
		fargateService.loadBalancer.logAccessLogs(
			new Bucket(this, loadBalancerLogName, {
				bucketName: loadBalancerLogName,
				autoDeleteObjects: true,
				removalPolicy: RemovalPolicy.DESTROY,
			}),
			'alb'
		);

		this.loadBalancer = fargateService.loadBalancer;
	}
}
