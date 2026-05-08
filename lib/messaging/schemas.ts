import { z } from "zod";

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const requiredText = (min: number, max: number) =>
  z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().min(min).max(max));

export const sendMessageSchema = z.object({
  message_text: requiredText(1, 4000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
