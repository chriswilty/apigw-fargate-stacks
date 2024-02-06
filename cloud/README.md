# CDK project for defining AWS resources

I have defined two different stack configurations in their own CDK apps, based
on a standard fargate container setup, but fronted by different variants of API
Gateway:

- `HTTP API Gateway => VPCLink => Application Load Balancer`
- `REST API Gateway => PrivateLink => Network Load Balancer => Application Load Balancer`

See the [main README](../README.md) for further details.

## Commands

All CDK commands use your active AWS environment as defined in your default
profile, unless you specify a different profile on command line.

Before you run any command, first time you need to
[bootstrap your AWS environment for CDK usage](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html),
else the command will fail with an informative message to remind you.

```
# Install dependencies
npm ci

# Create a stack for the developer policy
aws cloudformation create-stack --stack-name CDKDeveloperPolicy --template-body file://cdk-developer-policy.yaml --capabilities CAPABILITY_NAMED_IAM

# Bootstrap your AWS environment
npx cdk bootstrap --custom-permissions-boundary cdk-developer-policy
```

### Synth

Synthesizes the CloudFormation templates for the desired CDK application.
The templates and asset definition are written to `cdk.out/` directory

- `npm run synth:http` generates the HTTP API Gateway stacks
- `npm run synth:rest` generates the REST API Gateway stacks

### Deploy

- `npm run deploy` deploys your AWS resources - make a note of the `APIGWURL` output, needed for deploying the UI...
- `API_URL=(insert APIGWURL here) npm run deploy:ui` deploys the UI bundle to the host bucket; only needed
  after first stack deployment, or when you make changes to the UI code

### Clean up

- `npm run destroy` destroys all deployed resources: clean up or pay up 😰
- `npm run clean` removes the `cdk.out` directory
