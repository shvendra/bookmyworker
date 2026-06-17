import { z } from 'zod';

export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{4,6}$/, 'Enter valid OTP'),
});

export const registerStep1Schema = z.object({
  role: z.enum(['Employer', 'Agent', 'SelfWorker'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
});

export const registerStep2Schema = z
  .object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(100, 'Name too long')
      .regex(/^[a-zA-Z\s'.'\-]+$/, 'Name can only contain letters, spaces and apostrophes'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    alternate: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit number')
      .optional()
      .or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    state: z.string().optional().or(z.literal('')),
    district: z.string().optional().or(z.literal('')),
    block: z.string().optional().or(z.literal('')),
    pinCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code').optional().or(z.literal('')),
    email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    referredBy: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit referral number')
      .optional()
      .or(z.literal('')),
    // SelfWorker-specific
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    dob: z.string().optional(),
    address: z.string().optional(),
    workExperience: z.string().optional(),
    salaryType: z.enum(['Fixed', 'Ranged', '']).optional(),
    fixedSalary: z.string().optional(),
    salaryFrom: z.string().optional(),
    salaryTo: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const kycSchema = z.object({
  fullName: z.string().optional(),
  language: z.enum(['en', 'hi', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'bn', 'or', 'pa']),
});

export const forgotPasswordStep1Schema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  role: z.enum(['Employer', 'Agent', 'SelfWorker'], {
    errorMap: () => ({ message: 'Please select your account type' }),
  }),
});

export const forgotPasswordStep3Schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PhoneFormValues = z.infer<typeof phoneSchema>;
export type OtpFormValues = z.infer<typeof otpSchema>;
export type RegisterStep1Values = z.infer<typeof registerStep1Schema>;
export type RegisterStep2Values = z.infer<typeof registerStep2Schema>;
export type KycFormValues = z.infer<typeof kycSchema>;
export type ForgotPasswordStep1Values = z.infer<typeof forgotPasswordStep1Schema>;
export type ForgotPasswordStep3Values = z.infer<typeof forgotPasswordStep3Schema>;
