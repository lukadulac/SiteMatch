export type ProviderServiceActionState = {
	formError?: string;
	formSuccess?: string;
	fieldErrors?: Record<string, string[] | undefined>;
	fields?: Record<string, string>;
};

export const initialProviderServiceActionState: ProviderServiceActionState = {
	formError: undefined,
	formSuccess: undefined,
	fieldErrors: {},
	fields: {},
};
