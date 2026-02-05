import { z } from "zod";

// Finalize submission schema
export const finalizeSubmissionSchema = z.object({
  submissionId: z.string().uuid("Invalid submission ID"),
  objectKey: z.string().min(1, "Object key is required"),
  filename: z.string().optional(),
  size: z.number().positive().optional(),
  contentType: z.string().optional(),
  source: z.enum(["premier", "faceit"]).default("premier"),
  map: z.string().optional(),
  match_rank_or_elo: z.string().optional(),
  suspected_steamid64: z.string().nullable().optional(),
  suspected_profile_url: z.string().url().nullable().optional().or(z.literal("")),
  spectate_player: z.string().optional(),
  must_check_rounds: z.array(z.number().int().min(1).max(30)).optional(),
  suspicion_reason: z.string().min(1, "Suspicion reason is required"),
});

export type FinalizeSubmissionInput = z.infer<typeof finalizeSubmissionSchema>;

// Presign upload schema
export const presignUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().optional(),
  size: z.number().positive("File size must be positive"),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
