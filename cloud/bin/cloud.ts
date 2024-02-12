#!/usr/bin/env node
import 'source-map-support/register';
import { App, Environment } from 'aws-cdk-lib';

import {
	FargateStack,
	HttpApiStack,
	RestApiStack,
	UiStack,
	utils
} from '../lib';

const app = new App();

const env: Environment = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION,
};

const generateDescription = utils.resourceDescription(app);
const generateStackName = utils.stackName(app);

const apiType: 'http' | 'rest' = app.node.tryGetContext('API_TYPE') || 'http';

const tags = {
	Project: utils.appName,
	Stage: utils.stageName.toUpperCase(),
	IaC: 'CDK',
};

const { cloudfrontUrl: webappUrl } = new UiStack(app, generateStackName('ui'), {
	description: generateDescription('UI Stack'),
	env,
	tags,
});

const {
	applicationLoadBalancer,
	logBucket,
	vpc
} = new FargateStack(app, generateStackName('fargate'), {
	description: generateDescription('Fargate Stack'),
	env,
	tags,
	webappUrl,
});

if (apiType === 'rest') {
	new RestApiStack(app, generateStackName('rest-api'), {
		description: generateDescription('REST API Stack'),
		env,
		tags,
		applicationLoadBalancer,
		logBucket,
		vpc,
		webappUrl,
	});
} else {
	new HttpApiStack(app, generateStackName('http-api'), {
		description: generateDescription('HTTP API Stack'),
		env,
		tags,
		applicationLoadBalancer,
		vpc,
		webappUrl,
	});
}
