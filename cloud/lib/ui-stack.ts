import {
	AllowedMethods,
	CacheCookieBehavior,
	CachePolicy,
	Distribution,
	OriginAccessIdentity,
	ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib/core';
import { CanonicalUserPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { appName, resourceName } from './resourceNamingUtils';

export class UiStack extends Stack {
	public readonly cloudfrontUrl: string;

	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const generateResourceName = resourceName(scope);

		// allow s3 to be secured
		const originAccessIdentity = new OriginAccessIdentity(
			this,
			generateResourceName('cloudfront-oai')
		);

		// Host bucket
		const bucketName = generateResourceName('host-bucket');
		const hostBucket = new Bucket(this, bucketName, {
			bucketName,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			removalPolicy: RemovalPolicy.DESTROY,
			autoDeleteObjects: true,
		});
		hostBucket.addToResourcePolicy(
			new PolicyStatement({
				actions: ['s3:GetObject'],
				resources: [hostBucket.arnForObjects('*')],
				principals: [
					new CanonicalUserPrincipal(
						originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
					),
				],
			})
		);

		// CloudFront
		const cachePolicyName = generateResourceName('site-cachepolicy');
		const cloudFront = new Distribution(this, generateResourceName('site-distribution'), {
			defaultRootObject: 'index.html',
			errorResponses: [
				{
					httpStatus: 404,
					responseHttpStatus: 200,
					responsePagePath: '/index.html',
					ttl: Duration.seconds(30),
				},
			],
			defaultBehavior: {
				origin: new S3Origin(hostBucket, {
					originAccessIdentity,
				}),
				cachePolicy: new CachePolicy(this, cachePolicyName, {
					cachePolicyName,
					cookieBehavior: CacheCookieBehavior.allowList(`${appName}.sid`),
				}),
				allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
				viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			},
		});
		this.cloudfrontUrl = `https://${cloudFront.domainName}`;

		new CfnOutput(this, 'WebURL', {
			value: this.cloudfrontUrl,
		});
	}
}
