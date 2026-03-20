
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/orders" | "/api/orders/complete" | "/api/stripe" | "/api/stripe/capture" | "/api/stripe/checkout" | "/login" | "/orders" | "/orders/[id]" | "/order" | "/scan";
		RouteParams(): {
			"/orders/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/api": Record<string, never>;
			"/api/orders": Record<string, never>;
			"/api/orders/complete": Record<string, never>;
			"/api/stripe": Record<string, never>;
			"/api/stripe/capture": Record<string, never>;
			"/api/stripe/checkout": Record<string, never>;
			"/login": Record<string, never>;
			"/orders": { id?: string };
			"/orders/[id]": { id: string };
			"/order": Record<string, never>;
			"/scan": Record<string, never>
		};
		Pathname(): "/" | "/api/orders/complete" | "/api/stripe/capture" | "/api/stripe/checkout" | "/login" | `/orders/${string}` & {} | "/order" | "/scan";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}