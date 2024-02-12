export type Counter = {
	count: number;
};

const defaultUrl = 'http://localhost:3000';
const baseUrl = new URL('/counter', process.env['API_URL'] ?? defaultUrl).toString();

const commonFetch = async (path: string, method: string = 'GET') =>
	fetch(`${baseUrl}/${path}`, {
		method,
		credentials: 'include',
	}).then((res) => res.json() as Promise<Counter>);

export const getCount = async () => commonFetch('');
export const increment = async () => commonFetch('up', 'PATCH');
export const decrement = async () => commonFetch('down', 'PATCH');
