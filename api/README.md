# apigw-fargate-stacks : API

Node Express server, demonstrating use of express-session to store session state
and (Secure or SameSite) Cookies to identify the session ID.

A simple counter value is stored in your session, starting at zero, and endpoints are provided to get, increment and
decrement the counter. As long as you return the session Cookie (provided in the initial server response) as a header
whenever you invoke an endpoint, you will receive the current value in every response. If you do not include the Cookie
header, the server will create a new, independent session.

See the [UI module](../ui/README.md) for a simple webapp that uses this API.

## Run me

```
# Locally
npm start

# Watch mode
npm run dev

# In a docker container
npm run docker:start
npm run docker:logs
npm run docker:stop
```

## The API

I'm not going to get into an argument about request methods and RESTfulness; if you don't like my patch you can go walk
the plank, yarrr.

- `GET /counter` - gets the current count
- `PATCH /counter/up` - increments the count and returns the new value
- `PATCH /counter/down` - decrements the count and returns the new value
