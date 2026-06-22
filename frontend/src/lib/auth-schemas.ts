import { z } from "zod";

// These mirror the backend class-validator DTOs in backend/src/auth/dto/*.
// Keep them in sync: the server is the source of truth and will reject
// anything weaker, so client rules must not be looser than the DTOs.

// LoginDto: email IsEmail, password MinLength(1).
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginValues = z.infer<typeof loginSchema>;

// SignupDto: name Min(1), email IsEmail, password Min(8), orgName Min(1).
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  orgName: z.string().trim().min(1, "Enter your organization name."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});
export type SignupValues = z.infer<typeof signupSchema>;

// ForgotPasswordDto: email IsEmail.
export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

// ResetPasswordDto / FirstLoginResetPasswordDto: newPassword Min(8). The UI
// adds a confirm field (not sent to the server) to catch typos early.
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Re-enter your password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Re-enter your password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const accountProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name."),
});
export type AccountProfileValues = z.infer<typeof accountProfileSchema>;
