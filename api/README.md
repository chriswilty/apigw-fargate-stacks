# apigw-fargate-stacks : API

Node Express server, demonstrating use of express-session to store session state
and (Secure or SameSite) Cookies to identify the session ID.

It's about as simple as you can get: a counter is stored in your session, starting at zero, with endpoints to get,
increment and decrement the counter. Opening the app concurrently in your browser of choice plus in a private browser
tab, or in a different browser, will result in different sessions with their own independent counters.

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

I'm not going to get into an argument about request methods and RESTfulness, if you don't like my patch you can go walk
the plank, yarrr.

- `GET /counter` - gets the current count
- `PATCH /counter/up` - increments the count and returns the new value
- `PATCH /counter/down` - decrements the count and returns the new value

