import { define, html, Model, store } from 'hybrids';

import { getCount, decrement, increment } from './api';
import type { Counter } from './api';

const Counter: Model<Counter> = {
	count: 0,
	[store.connect]: {
		get: () => getCount(),
		set: (_model, value) => value
	},
};

interface CounterView {
	counter: Counter;
}

const incrementCount = async (host: CounterView) => {
	await store.set(host.counter, await increment());
};
const decrementCount = async (host: CounterView) => {
	if (host.counter.count > 0) {
		await store.set(host.counter, await decrement());
	}
}

define<CounterView>({
	tag: 'counter-view',
	counter: store(Counter),
	render: ({ counter }) => html`
		<main>
			<h1>Counter</h1>
			<div class="value">${store.ready(counter) ? counter.count : '-'}</div>
			<div class="control-box">
				<button
					aria-disabled="${store.ready(counter) && counter.count > 0 ? 'false' : 'true'}"
					onclick="${decrementCount}"
				>
					<span class="arrow" aria-hidden="true">&darr;</span>
					Down
				</button>
				<button
					aria-disabled="${'' + !store.ready(counter)}"
					onclick="${incrementCount}"
				>
					<span class="arrow" aria-hidden="true">&uarr;</span>
					Up
				</button>
			</div>
		</main>
	`.css`
		:host {
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100%;
		}
		main {
			display: grid;
			align-items: center;
			gap: 0.75rem;
			text-align: center;
		}
		h1 {
			margin: 0;
			border: 2px solid white;
			border-radius: 0.5rem;
			padding: 1rem;
			font-size: 2rem;
		}
		.value {
			border: 2px solid white;
			border-radius: 0.5rem;
			padding: 1rem;
			background-color: teal;
			font-size: 8rem;
		}
		.control-box {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.75rem;
		}
		button {
			position: relative;
			border: 2px solid white;
			border-radius: 0.5rem;
			padding: 1rem 0.5rem;
			background: none;
			font-size: 1.5rem;
			color: inherit;
			cursor: pointer;
		}
		button:focus-visible {
			outline: 0.25rem solid teal;
		}
		button:active {
			background-color: teal;
		}
		button[aria-disabled=true] {
			cursor: not-allowed;
			background-color: #333;
			color: #CCC;
		}
		button ~ .tooltip {
			display: none;
		}
		button[aria-disabled=true]:focus-visible::after,
		button[aria-disabled=true]:hover::after {
			content: 'Value cannot be negative';
			position: absolute;
			top: calc(100% + 0.5rem);
			left: 0;
			font-size: 1.25rem;
			white-space: nowrap;
		}
		button .arrow {
			font-size: 2rem;
			line-height: 1;
		}
	`
});
