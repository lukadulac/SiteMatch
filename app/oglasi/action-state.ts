export type ListingsActionState = {
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  fields?: Record<string, string>;
};

export const initialListingsActionState: ListingsActionState = {
  formError: undefined,
  fieldErrors: {},
  fields: {},
};
