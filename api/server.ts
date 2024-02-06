import cors from 'cors';
import express from 'express';
import session from 'express-session';
import memoryStoreFactory from 'memorystore';

declare module 'express-session' {
	interface SessionData {
		count: number;
	}
}

const allowOrigin = process.env['CORS_ALLOW_ORIGIN'];
const counterPath = '/counter';
const maxCookieAge = 60 * 60 * 1000; //1hr session keep-alive
const port = Number.parseInt(process.env['PORT'] ?? '3000');
const sessionSigningSecret =
	'In a real app this might be read from a secrets manager';

const app = express();
const env = app.get('env');
const isProd = env === 'production';
console.log(`env=${env}`);

// Generic middleware
app
	.use(express.json())
	.use(cors({
		origin: allowOrigin,
		credentials: true,
	}));

// Session shenanigans
app
	.set('trust proxy', isProd)
	.use(
		counterPath,
		session({
			// TODO Read SID from env vars!
			name: 'apigw-fargate.sid',
			resave: false,
			saveUninitialized: true,
			secret: sessionSigningSecret,
			store: new (memoryStoreFactory(session))({
				checkPeriod: maxCookieAge,
			}),
			cookie: {
				maxAge: maxCookieAge,
				path: counterPath,
				sameSite: isProd ? 'none' : 'strict',
				secure: isProd
			},
		}),
		(req, _res, next) => {
			// initialise session first time
			if (req.session.count === undefined) {
				req.session.count = 0;
			}
			next();
		}
	);

// Main route handlers
app
	.get(counterPath, (req, res) => {
		res.send({ count: req.session.count });
	})
	.patch(`${counterPath}/up`, (req, res) => {
		req.session.count = (req.session.count ?? 0) + 1;
		res.send({ count: req.session.count });
	})
	.patch(`${counterPath}/down`, (req, res) => {
		req.session.count = Math.max(0, (req.session.count ?? 0) - 1);
		res.send({ count: req.session.count });
	});

// Health-check for remote deployment
app.get('/health', (_req, res) => {
	res.send();
})

// Run the bugger
app.listen(port, () => console.log(`Server started on port ${port}`));
