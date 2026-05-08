export type AuthActionState = {
  formError?: string;
  formSuccess?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  fields?: Record<string, string>;
};

export const initialAuthActionState: AuthActionState = {
  formError: undefined,
  formSuccess: undefined,
  fieldErrors: {},
  fields: {},
};
