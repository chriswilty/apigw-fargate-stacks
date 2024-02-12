import { CorsHttpMethod, HttpApi, VpcLink } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpAlbIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { CfnOutput, Stack, StackProps, Tags } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import { resourceName } from './resourceNamingUtils';

type HttpApiStackProps = StackProps & {
	applicationLoadBalancer: ApplicationLoadBalancer;
	vpc: Vpc;
	webappUrl: string;
}

export class HttpApiStack extends Stack {
	constructor(scope: Construct, id: string, props: HttpApiStackProps) {
		super(scope, id, props);

		const { applicationLoadBalancer, vpc, webappUrl } = props;

		const generateResourceName = resourceName(scope);

		// Create a VPCLink to expose our private load balancer
		const vpcLinkName = generateResourceName('vpclink');
		const vpcLink = new VpcLink(this, vpcLinkName, {
			vpc,
			vpcLinkName,
		});

		const securityGroupName = generateResourceName('vpclink-sg');
		const vpcLinkSecurityGroup = new SecurityGroup(this, securityGroupName, {
			vpc,
			securityGroupName,
			allowAllOutbound: false,
		});
		vpcLinkSecurityGroup.connections.allowFromAnyIpv4(Port.tcp(80), 'APIGW to VPCLink');
		vpcLinkSecurityGroup.connections.allowTo(applicationLoadBalancer, Port.tcp(80), 'VPCLink to ALB');
		vpcLink.addSecurityGroups(vpcLinkSecurityGroup);

		// Tags are not propagated, so must do this manually
		Object.entries(props.tags ?? {}).forEach(([key, value]) => {
			Tags.of(vpcLink).add(key, value);
		});

		// Create an HTTP API as a secure proxy
		const apiName = generateResourceName('api');
		const api = new HttpApi(this, apiName, {
			apiName,
			corsPreflight: {
				allowOrigins: [webappUrl],
				allowMethods: [
					CorsHttpMethod.HEAD,
					CorsHttpMethod.OPTIONS,
					CorsHttpMethod.GET,
					CorsHttpMethod.PATCH // CorsHttpMethod.ANY does not work!
				],
				allowHeaders: ['X-Forwarded-For', 'Content-Type', 'Authorization'],
				allowCredentials: true,
			},
		});
		api.addRoutes({
			path: '/{proxy+}',
			integration: new HttpAlbIntegration(
				generateResourceName('api-integration'),
				applicationLoadBalancer.listeners[0],
				{ vpcLink },
			),
		});

		new CfnOutput(this, 'APIGW URL', {
			value: api.defaultStage?.url ?? 'ERROR: No default stage added!'
		});
	}
}
