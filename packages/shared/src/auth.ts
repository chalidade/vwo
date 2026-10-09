// Shapes of the account requests, shared by the forms and the API so both check the same rules.
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8, "Password minimal 8 karakter").max(128);
export const displayNameSchema = z.string().trim().min(2).max(40);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
  /** The seeker accepted the terms and the privacy policy. */
  acceptTerms: z.literal(true),
  /** Hidden from people; a bot that fills every field fills this one too. */
  website: z.string().max(200).optional(),
  /** Cloudflare Turnstile answer, when the site has it turned on. */
  captcha: z.string().max(4000).optional(),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifySchema = z.object({ token: z.string().min(20).max(200) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
