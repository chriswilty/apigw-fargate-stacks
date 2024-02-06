import { Construct } from 'constructs';

export const appName = 'ApiGwFargate';

export const stageName = 'demo';

export const resourceName = (construct: Construct) => (suffix: string) =>
	`${stageName}-${appName}-${suffix}`.toLowerCase();

export const resourceDescription = (construct: Construct) => (prefix: string) =>
	`${prefix} for ${appName} (${stageName})`;

export const stackName = (construct: Construct) => (name: string) =>
	resourceName(construct)(`${name}-stack`);
