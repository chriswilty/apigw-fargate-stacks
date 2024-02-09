import cors from 'cors';
import express from 'express';
import session from 'express-session';
import memoryStoreFactory from 'memorystore';

declare module 'express-session' {
	interface SessionData {
		count: number;
	}
	interface CookieOptions {
		partitioned: boolean; // TODO express-session types are not yet up-to-date!
	}
}

const cookieSID = process.env['COOKIE_SID'];
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

// Alas, "trust proxy" is broken by default with Express behind HTTP API Gateway:
// https://github.com/expressjs/express/issues/5459
// https://repost.aws/en/questions/QUtBHMaz7IQ6aM4RCBMnJvgw/why-does-apigw-http-api-use-forwarded-header-while-other-services-still-use-x-forwarded-headers
//
// Therefore we use Express API overrides to modify our Request IP and Protocol properties:
// https://expressjs.com/en/guide/overriding-express-api.html
const parseForwardedHeader = (header?: string) =>
	header?.split(",")
		.flatMap((proxy) => proxy.split(';'))
		.reduce(
			(result, proxyProps) => {
				const [key, value] = proxyProps.split('=');
				if (key && value) {
					result[key] = (result[key] || []).concat(value);
				}
				return result;
			},
			{} as Record<string, string[]>
		);

Object.defineProperty(app.request, 'ip', {
	configurable: true,
	enumerable: true,
	get() {
		const header = this.header('Forwarded') as ReturnType<typeof app.request.header>;
		const proxies = parseForwardedHeader(header);
		return proxies?.['for']?.[0] ?? this.socket.remoteAddress;
	}
});

Object.defineProperty(app.request, 'protocol', {
	configurable: true,
	enumerable: true,
	get() {
		const header = this.header('Forwarded') as ReturnType<typeof app.request.header>;
		const proxies = parseForwardedHeader(header);
		return proxies?.['proto']?.[0] ?? this.socket.encrypted ? 'https' : 'http';
	}
});

// Generic middleware
app
	.use(express.json())
	.use(cors({
		origin: allowOrigin,
		credentials: true,
	}));

// Session shenanigans
app
	.use(
		counterPath,
		session({
			name: cookieSID,
			resave: false,
			saveUninitialized: true,
			secret: sessionSigningSecret,
			store: new (memoryStoreFactory(session))({
				checkPeriod: maxCookieAge,
			}),
			cookie: {
				maxAge: maxCookieAge,
				path: counterPath,
				partitioned: isProd,
				sameSite: isProd ? 'none' : 'strict',
				secure: isProd,
			},
		}),
		(req, _res, next) => {
			// initialise session first time
			if (req.session.count === undefined) {
				req.session.count = 0;
			}
			next();
		},
		(req, res, next) => {
			console.log('Request:', req.ip, `secure=${req.secure}`, req.headers);
			res.on('finish', () => {
				console.log('Response:', req.path, res.getHeaders());
			});
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
