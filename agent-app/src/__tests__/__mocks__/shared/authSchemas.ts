// Real zod schemas so react-hook-form + zodResolver behave as in production:
// invalid input blocks submit, valid input calls the handler.
import { z } from 'zod';

export const registerStep2Schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit number'),
    password: z.string().min(6, 'Min 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const kycSchema = z.object({
  fullName: z.string().optional(),
  language: z.enum(['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'bn', 'or', 'pa']),
});

export type RegisterStep2Values = z.infer<typeof registerStep2Schema>;
export type KycFormValues = z.infer<typeof kycSchema>;
