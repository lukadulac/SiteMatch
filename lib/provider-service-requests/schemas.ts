import z from "zod";

export const createServiceRequestSchema = z.object({
	message: z
		.string()
		.trim()
		.min(10, "Message must be at least 10 characters long.")
		.max(2000, "Message must be 2000 characters or fewer."),
});

export type CreateServiceRequestInput = z.infer<
	typeof createServiceRequestSchema
>;

export type CreateServiceRequestFormFields = {
	message: string;
};
