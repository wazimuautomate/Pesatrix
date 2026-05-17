/**
 * Pesatrix Database Types
 * Generated from Pesatrix_Backend_Database_API_Spec.md
 */

export type AccountState =
  | "registered"
  | "pending_activation"
  | "activated"
  | "setup_complete"
  | "suspended";

export type WalletTransactionType =
  | "task_earning"
  | "referral_bonus"
  | "activation_fee"
  | "deposit"
  | "withdrawal"
  | "admin_adjustment"
  | "reward"
  | "reversal";

export type WalletBucket = "pending" | "available" | "locked";

export type WalletTransactionStatus =
  | "pending"
  | "available"
  | "locked"
  | "reversed";

export type TrainingProgramStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_test"
  | "completed";

export type WithdrawalStatus =
  | "requested"
  | "processing"
  | "sent"
  | "failed"
  | "held";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type AdminRole = "super_admin" | "support" | "finance" | "viewer";

export type RewardSpinType = "free" | "paid";

export type RewardSpinOutcome =
  | "miss"
  | "small"
  | "medium"
  | "double"
  | "jackpot";

export type AiProvider = "nvidia" | "openrouter" | "groq" | "ollama";

export type NotificationStatus = "pending" | "sent" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          county: string | null;
          metadata: Record<string, unknown>;
          phone_verified: boolean;
          email_verified: boolean;
          referral_code: string;
          referred_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "created_at" | "updated_at" | "referral_code" | "metadata"
        > & { referral_code?: string; metadata?: Record<string, unknown> };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      account_status: {
        Row: {
          user_id: string;
          state: AccountState | null;
          status: string | null;
          is_activated: boolean | null;
          is_setup_complete: boolean | null;
          activated_at: string | null;
          setup_completed_at: string | null;
          suspended_at: string | null;
          suspension_reason: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["account_status"]["Row"], "updated_at">;
        Update: Partial<Database["public"]["Tables"]["account_status"]["Insert"]>;
      };
      user_verification: {
        Row: {
          user_id: string;
          phone_verified: boolean | null;
          email_verified: boolean | null;
          kyc_status: string | null;
          id_type: string | null;
          id_number_hash: string | null;
          id_verified: boolean;
          selfie_url: string | null;
          selfie_verified: boolean;
          verified_at: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_verification"]["Row"], "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_verification"]["Insert"]>;
      };
      activation_payments: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          phone: string;
          merchant_request_id: string | null;
          mpesa_receipt: string | null;
          checkout_request_id: string | null;
          callback_raw: Record<string, unknown> | null;
          status: "pending" | "paid" | "failed" | "reversed";
          paid_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["activation_payments"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["activation_payments"]["Insert"]>;
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          level: 1 | 2 | 3;
          source: "signup" | "admin" | "import";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["referrals"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
      };
      referral_bonuses: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          amount: number;
          level: 1 | 2 | 3;
          status: "pending" | "available" | "revoked";
          available_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["referral_bonuses"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["referral_bonuses"]["Insert"]>;
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: WalletTransactionType;
          direction: "credit" | "debit";
          amount: number;
          status: WalletTransactionStatus;
          bucket: WalletBucket;
          description: string | null;
          reference_table: string | null;
          reference_id: string | null;
          available_at: string | null;
          created_by_admin_id: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["wallet_transactions"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["wallet_transactions"]["Insert"]>;
      };
      reward_spins: {
        Row: {
          id: string;
          user_id: string;
          spin_type: RewardSpinType;
          outcome: RewardSpinOutcome;
          payout_amount: number;
          spin_cost: number;
          net_amount: number;
          entropy_digest: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reward_spins"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reward_spins"]["Insert"]>;
      };
      training_progress: {
        Row: {
          user_id: string;
          status: TrainingProgramStatus;
          current_day: number;
          current_stage: number;
          stage_attempt: number;
          completed_days: number[];
          failed_stage_attempts: Record<string, number>;
          next_day_unlock_at: string | null;
          last_completed_at: string | null;
          completed_at: string | null;
          reward_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["training_progress"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["training_progress"]["Insert"]>;
      };
      notification_outbox: {
        Row: {
          id: string;
          channel: "email";
          event_type: string;
          recipient_user_id: string | null;
          recipient_email: string | null;
          payload: Record<string, unknown>;
          status: NotificationStatus;
          provider: string | null;
          external_id: string | null;
          error_message: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["notification_outbox"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["notification_outbox"]["Insert"]>;
      };
      withdrawal_requests: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          phone: string;
          status: WithdrawalStatus;
          mpesa_txn_id: string | null;
          processed_at: string | null;
          failure_reason: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["withdrawal_requests"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["withdrawal_requests"]["Insert"]>;
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          category: string;
          status: TicketStatus;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["support_tickets"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Insert"]>;
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          is_admin: boolean;
          body: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["support_messages"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["support_messages"]["Insert"]>;
      };
      admin_users: {
        Row: {
          user_id: string;
          role: AdminRole;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["admin_users"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["admin_users"]["Insert"]>;
      };
      audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_type: string;
          target_id: string;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          category: string;
          description: string | null;
          instructions: string;
          payout_ksh: number;
          total_slots: number;
          slots_remaining: number;
          difficulty: string;
          status: string;
          publish_at: string | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          ai_grading_enabled: boolean;
          ai_rubric: string | null;
          requires_screenshot: boolean;
          requires_url: boolean;
          min_word_count: number;
          task_data: Record<string, unknown>;
        };
        Insert: Omit<Database["public"]["Tables"]["tasks"]["Row"], "id" | "created_at" | "updated_at" | "slots_remaining">;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      task_submissions: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          submitted_at: string;
          answers: Record<string, unknown>;
          screenshot_url: string | null;
          submitted_url: string | null;
          status: string;
          ai_score: number | null;
          ai_reasoning: string | null;
          ai_reviewed_at: string | null;
          admin_reviewed_by: string | null;
          admin_decision: string | null;
          admin_note: string | null;
          admin_reviewed_at: string | null;
          payout_credited: boolean;
          payout_credited_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["task_submissions"]["Row"], "id" | "submitted_at" | "status" | "payout_credited">;
        Update: Partial<Database["public"]["Tables"]["task_submissions"]["Insert"]>;
      };
      ai_provider_configs: {
        Row: {
          id: string;
          provider: AiProvider;
          model_id: string;
          display_name: string;
          api_key_secret_name: string;
          is_active: boolean;
          is_grading_model: boolean;
          base_url: string;
          max_tokens: number;
          temperature: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["ai_provider_configs"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_provider_configs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_state: AccountState;
      wallet_transaction_type: WalletTransactionType;
      wallet_bucket: WalletBucket;
      withdrawal_status: WithdrawalStatus;
      ticket_status: TicketStatus;
      admin_role: AdminRole;
    };
  };
}
