import { z } from "zod";

export const hotelFormSchema = z.object({
  name: z.string().trim().min(2, "Hotel name is required."),
  city: z.string().trim().min(2, "City is required."),
  country: z.string().trim().min(2, "Country is required."),
  address: z.string().trim().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  turnstileToken: z.string().optional(),
  anonymousScoutId: z.string().trim().min(6).max(80).optional()
});

export const reportFormSchema = z.object({
  status: z.enum(["yes", "no", "unsure"]),
  observedDate: z.string().min(10),
  breakfastContext: z.enum(["buffet", "other"]),
  note: z.string().trim().max(280).optional()
});


export const reportApiSchema = reportFormSchema.extend({
  hotelId: z.string().uuid("Hotel id must be a valid UUID."),
  photoDataUrl: z.string().optional(),
  photoUrl: z.string().url().optional(),
  turnstileToken: z.string().optional(),
  anonymousScoutId: z.string().trim().min(6).max(80).optional()
});
