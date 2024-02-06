#!/usr/bin/env node
import 'source-map-support/register';
import { App, Environment } from 'aws-cdk-lib';

import {
	FargateStack,
	HttpApiStack,
	UiStack,
	utils
} from '../lib';

const awsEnv = (() => {
	let environment: Environment;
	return () => {
		if (!environment) {
			environment = {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: process.env.CDK_DEFAULT_REGION,
			};
		}
		return environment;
	};
})();

const app = new App();

const generateDescription = utils.resourceDescription(app);
const generateStackName = utils.stackName(app);

const tags = {
	Project: utils.appName,
	Stage: utils.stageName.toUpperCase(),
	IaC: 'CDK',
};

const uiStack = new UiStack(app, generateStackName('ui'), {
	description: generateDescription('UI Stack'),
	env: awsEnv(),
	tags,
});

const fargateStack = new FargateStack(app, generateStackName('fargate'), {
	description: generateDescription('Fargate Stack'),
	env: awsEnv(),
	tags,
	webappUrl: uiStack.cloudfrontUrl,
});

new HttpApiStack(app, generateStackName('http-api'), {
	description: generateDescription('HTTP API Stack'),
	env: awsEnv(),
	tags,
	loadBalancer: fargateStack.loadBalancer,
	vpc: fargateStack.vpc,
	webappUrl: uiStack.cloudfrontUrl,
});
