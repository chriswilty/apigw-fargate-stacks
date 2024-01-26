# apigw-fargate-stacks

This is a demo application for an AWS Fargate stack, without needing domain and certificate.

## TL;DR

- ✔️ Requests can be securely routed through API Gateway to a containerised Express server behind a private load balancer
- ❌ Secure cookies will not make it through

## Contents
* [Motivation](#motivation)
* [The Problem: Remote Development Environment](#the-problem-remote-development-environment)
* [The Solution?](#the-solution)
  * [1. HTTP API](#1-http-api)
  * [2. REST API](#2-rest-api)
* [Oh Solution, Where Art Thou?](#oh-solution-where-art-thou)
* [Try It Yourself](#try-it-yourself)
  * [Install dependencies](#install-dependencies)
  * [Run the application locally](#run-the-application-locally)
  * [Deploy the stacks](#deploy-the-stacks)

## Motivation

While working on the [Prompt Injection Mitigation](https://github.com/ScottLogic/prompt-injection) repo, I was tasked
with generating infrastructure-as-code templates for deploying resources to AWS.
The project has a standard React [SPA](https://en.wikipedia.org/wiki/Single-page_application) UI,
and a containerised [Node Express](https://www.npmjs.com/package/express) back-end. For the infrastructure, I am using
[AWS CDK framework](https://docs.aws.amazon.com/cdk/v2/guide/home.html) as it makes the infrastructure super-easy and
even _enjoyable_ to define! Not something you can say about any of the YAML-based template solutions
(yes I'm talking about you:
[CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/gettingstarted.templatebasics.html),
[Terraform](https://developer.hashicorp.com/terraform),
[Serverless](https://www.serverless.com/framework/docs/providers/aws/guide/serverless.yml)
et al).

For the UI, it is trivial to provision and deploy our bundle to an S3 bucket behind
[CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html.
But the API has a stumbling block: we are using a
[Secure Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#secure) to pass a session ID
between UI and API, which it seems Express will not send if it thinks the connection is not secure (i.e. http not
https). While you can tell Express to trust proxy servers in between, this currently relies on
[X-Forwarded-* headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For) being correctly added
by the proxy server(s) to represent the client origin (plus all proxies) along the route.

Our API stack will be using [AWS Fargate](https://aws.amazon.com/fargate/) to deploy and manage our container, fronted
by an Application Load Balancer (ALB), which does indeed append these headers. Our production environment turns out to
be rather flexible to configure, because in addition to the ALB being _secure_ (so Express can trust it) we will be
using our own domain for both UI and API (via [Route53](https://aws.amazon.com/route53/faqs/)) meaning they are
classified as [SameSite](https://owasp.org/www-community/SameSite). This means our cookie doesn't even need to be
secure, which would be fine for us as all it contains is a session ID, nothing sensitive.

Running the application locally is also fine, because UI and API are both on localhost - also classed as SameSite
despite being on different ports (this ain't [CORS](https://web.dev/articles/same-site-same-origin), folks).

## The Problem: Remote Development Environment

This all sounds lovely, but we don't yet have a ScottLogic subdomain registered for our application. We might even
decide to buy a fancy domain of its own, and use [ACM](https://aws.amazon.com/certificate-manager/) for hassle-free
certificate management. In either case we want to show we can deploy our application to AWS, fully functional and
robust, until we have an application ready to Go Live. And of course tear it down again super-fast.

We won't want to expose our ALB publicly if it is insecure, which leaves us needing some sort of secure proxy in front.
Step forward, [API Gateway](https://docs.aws.amazon.com/apigateway/)!

## The Solution?

There are now two ways to route traffic through API Gateway to/from a containerised server fronted by a load balancer.

### 1. HTTP API

![HTTP API to ALB to Fargate architecture](./docs/APIGW-ALB.png)

The newer [HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html) from API Gateway is
lightweight and costs less than REST API, and as a distinct bonus, it supports integration with an ALB. For this, we
define a [VPC Link](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vpc-links.html) to access the
ALB within our [Virtual Private Cloud (VPC)](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html).
It all fits together remarkably smoothly, despite one hiccup with Security Groups I encountered along the way.

But gosh darn, it turns out we have a disagreement between AWS services... Crucially, is a disagreement about which
headers to use for identifying our client origin and proxies. HTTP API uses the new "standardized"
[Forwarded header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Forwarded), whereas ALB uses the
[X-Forwarded- headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For) which
MDN describes as "de-facto standard headers" (Confused? Me too). The end result is that our server receives both
flavours of header, and even if Express was respecting the Forwarded header, which it currently isn't, it wouldn't know
how to combine the headers to reproduce the correct order of client and proxies along the route. Furthermore, for
good reason HTTP API does not allow adding or modifying either of these
[reserved headers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-parameter-mapping.html#http-api-mapping-reserved-headers),
so we cannot even map the values from one header to the other.

The bottom line: Unless the (HTTP) API Gateway or Elastic Load Balancer teams decide to allow configuring which forwarded
header to apply, we are
[shit outta luck](https://repost.aws/questions/QUtBHMaz7IQ6aM4RCBMnJvgw/why-does-apigw-http-api-use-forwarded-header-while-other-services-still-use-x-forwarded-headers).

### 2. REST API

![HTTP API to NLB to ALB to Fargate architecture](./docs/APIGW-NLB.png)

Before HTTP API arrived, you could integrate a public
[REST API](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-rest-api.html) with a
[Network Load Balancer (NLB)](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) inside
a VPC by defining a
[VPCLink](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-nlb-for-vpclink-using-console.html). The
NLB will route traffic to the ALB, which in turn routes it to your container(s). That's a lot of services and a fair
amount of config, so this is far from ideal. But despite a few hiccups along the way, it is possible.

However, it turns out this stack also has a showstopper for our secure cookies use case: REST API does not appear to add
our (cloudfronted, secure) client to the X-Forwarded headers, and REST API does not support modifying headers with a
[proxy integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-override-request-response-parameters.html),
so there is no way to tell our server it is both behind a secure, trusted proxy, and that the request originated from a
secure client. So while we can successfully route our requests, we cannot transmit secure cookies, so we cannot preserve
sessions.

The bottom line: Unless the (REST) API Gateway team corrects the addition of forwarded headers to accurately represent
the client origin, we are up that creek again 🛶

## Oh Solution, Where Art Thou?

If you can spot a flaw in my code or my thinking, or you are aware of an alternative (using AWS), then please submit an
issue and I'll take a look.

## Try It Yourself

You can run the UI and API locally, to see how it _should_ work.
You can then deploy the stacks to your AWS account (either of the two "solutions") and see how it _doesn't_ work.

### Install dependencies

```
# From this directory:
npm install
```

### Run the application locally

```
# Run these in separate terminals:
npm run start:api
npm run start:ui
```

### Deploy the stacks

If you have not used [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) before,
you will need to install it and then
[configure a profile](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

If you have not used CDK to manage your resources before, you will need to
[bootstrap your AWS environment for CDK](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html). In its simplest
form, this means invoking `npx cdk bootstrap` from the cloud directory, which will bootstrap the environment defined in
your default profile; see the preceding links for information and more options.

Deploying the stacks takes a while, so be patient. Command-line output is verbose enough that you can see
how far you've come ⏳

```
# From the cloud directory, run these commands:
npm run cdk:synth
npm run cdk:deploy

# After testing, remember to destroy your stacks to avoid accumulating costs:
npm run cdk:destroy
```

Once the stacks are deployed, you should see the Site URL output on command-line, or you can log into the AWS
console and find your distribution in CloudFront. Open the URL in your browser, and click away! Then open the URL in a
different browser, or a private window, and see what happens... 
