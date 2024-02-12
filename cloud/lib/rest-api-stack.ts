import {
	ConnectionType,
	Cors,
	Integration,
	IntegrationType,
	RestApi,
	VpcLink,
} from 'aws-cdk-lib/aws-apigateway';
import { Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
	ApplicationLoadBalancer,
	NetworkLoadBalancer,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AlbTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnOutput, Duration, Stack, StackProps, Tags } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { resourceName, stageName } from './resourceNamingUtils';

type RestApiStackProps = StackProps & {
	applicationLoadBalancer: ApplicationLoadBalancer;
	logBucket: Bucket;
	vpc: Vpc;
	webappUrl: string;
};

export class RestApiStack extends Stack {
	constructor(scope: Construct, id: string, props: RestApiStackProps) {
		super(scope, id, props);

		const { applicationLoadBalancer, logBucket, vpc, webappUrl } = props;
		const { HEALTHCHECK_PATH } = process.env;

		const generateResourceName = resourceName(scope);

		// Create network loadbalancer targeting our application loadbalancer
		const nlbName = generateResourceName('nlb');
		const nlbListenerName = generateResourceName('nlb-listener');
		const nlbTargetName = generateResourceName('nlb-targets');
		const nlbSecurityGroupName = generateResourceName('nlb-secgroup');

		const nlbSecurityGroup = new SecurityGroup(this, nlbSecurityGroupName, {
			vpc,
			securityGroupName: nlbSecurityGroupName,
		});
		// Allow inbound from API Gateway
		nlbSecurityGroup.connections.allowFromAnyIpv4(Port.tcp(80), 'AIPGW to NLB');

		const nlb = new NetworkLoadBalancer(this, nlbName, {
			loadBalancerName: nlbName,
			vpc,
			securityGroups: [nlbSecurityGroup],
		});
		nlb.logAccessLogs(logBucket, 'net-lb');

		const nlbListener = nlb.addListener(nlbListenerName, { port: 80 });
		nlbListener.addTargets(nlbTargetName, {
			targets: [new AlbTarget(applicationLoadBalancer, 80)],
			port: 80,
			healthCheck: {
				path: HEALTHCHECK_PATH,
				interval: Duration.seconds(60),
				healthyThresholdCount: 2,
				unhealthyThresholdCount: 2,
			},
		});

		const vpcLinkName = generateResourceName('vpclink');
		const vpcLink = new VpcLink(this, vpcLinkName, {
			vpcLinkName,
			targets: [nlb],
		});
		Object.entries(props.tags ?? {}).forEach(([key, value]) => {
			Tags.of(vpcLink).add(key, value);
		});

		const apiName = generateResourceName('api');
		const api = new RestApi(this, apiName, {
			restApiName: apiName,
			deployOptions: { stageName },
		});
		api.root
			.addProxy({
				defaultMethodOptions: {
					requestParameters: {
						'method.request.path.proxy': true, //TODO blog this!
					},
				},
				defaultIntegration: new Integration({
					type: IntegrationType.HTTP_PROXY,
					uri: `http://${nlb.loadBalancerDnsName}/{proxy}`, //TODO blog this!
					integrationHttpMethod: 'ANY',
					options: {
						connectionType: ConnectionType.VPC_LINK,
						vpcLink,
						requestParameters: {
							'integration.request.path.proxy': 'method.request.path.proxy', //TODO blog this!
						},
					},
				}),
				anyMethod: true,
			})
			.addCorsPreflight({
				allowOrigins: [webappUrl],
				allowMethods: Cors.ALL_METHODS,
				allowHeaders: ['X-Forwarded-For', 'Content-Type', 'Authorization'],
				allowCredentials: true, // Need this for Cookie headers //TODO blog this!
			});

		new CfnOutput(this, 'APIGatewayURL', { value: api.url });
	}
}
