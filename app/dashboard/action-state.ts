export type DashboardActionState = {
  formError?: string;
  formSuccess?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  fields?: Record<string, string>;
};

export const initialDashboardActionState: DashboardActionState = {
  formError: undefined,
  formSuccess: undefined,
  fieldErrors: {},
  fields: {},
};
