export type DemoSource = "premier" | "faceit";
export type SubmissionStatus = "new" | "reviewed";
export type SubmissionVerdict = "cheater" | "clean" | "inconclusive";
export type WorkerStatus = "queued" | "processing" | "complete" | "failed";
export type UserRole = "sparkles" | "moderator";

export interface Submission {
  id: string;
  created_at: string;
  submitted_at: string | null;
  submitter_steamid64: string;
  submitter_persona_name: string | null;
  submitter_avatar_url: string | null;
  source: DemoSource;
  demo_object_key: string | null;
  demo_original_filename: string | null;
  demo_size_bytes: number | null;
  demo_mime: string | null;
  demo_valid: boolean | null;
  demo_validation_error: string | null;
  match_rank_or_elo: string | null;
  map: string | null;
  match_date: string | null;
  suspected_steamid64: string | null;
  suspected_profile_url: string | null;
  suspected_persona_name: string | null;
  suspected_avatar_url: string | null;
  spectate_player: string | null;
  start_tick_or_round: string | null; // deprecated
  must_check_rounds: number[] | null;
  suspicion_reason: string | null;
  status: SubmissionStatus;
  verdict: SubmissionVerdict | null;
  admin_notes: string | null;
  tags: string[] | null;
  inventory_value_cents: number | null;
  inventory_value_currency: string | null;
  inventory_value_updated_at: string | null;
  inventory_value_error: string | null;
  inventory_top_items: { name: string; price_cents: number; icon_url: string }[] | null;
  worker_status: WorkerStatus | null;
}

export interface UserRoleRecord {
  steamid64: string;
  role: UserRole;
  created_at: string;
}

export interface SubmissionFormData {
  source: DemoSource;
  map: string;
  match_rank_or_elo: string;
  match_date?: string;
  suspected_profile_url: string;
  spectate_player: string;
  must_check_rounds?: number[];
  suspicion_reason: string;
}
