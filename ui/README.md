# apigw-fargate-stacks : UI

A simple Web Components counter application, built using [hybrids](https://hybrids.js.org) which I've been wanting to
try for ages.

The UI establishes a session with the [API](../api/README.md), using a Cookie\* to identify the session. State is stored
server-side, and API operations are exclusively used for incrementing and decrementing the current value.

On initial load, the UI fetches the current value from the API, or establishes a new session if you don't yet have one.
Buttons are provided to increment and decrement the counter.

> \*Note: Cookie is SameSite but not Secure when running locally, Cross-Site and Secure when running in the cloud.

## Run me

Note that the [API](../api/README.md) needs to be running first!

```
# In watch mode
npm start

# Build for prod and serve locally
npm run build && npx serve dist -l 1234
```
