export type DashboardActionState = {
  formError?: string;
  formSuccess?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialDashboardActionState: DashboardActionState = {
  formError: undefined,
  formSuccess: undefined,
  fieldErrors: {},
};
