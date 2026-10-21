export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_moderation: {
        Row: { user_id: string; status: "active" | "suspended" | "banned" | "deleted"; suspended_until: string | null; reason: string; updated_at: string; auth_deleted_at: string | null };
        Insert: { user_id: string; status: "active" | "suspended" | "banned" | "deleted"; suspended_until?: string | null; reason: string; updated_at?: string; auth_deleted_at?: string | null };
        Update: { status?: "active" | "suspended" | "banned" | "deleted"; suspended_until?: string | null; reason?: string; updated_at?: string; auth_deleted_at?: string | null };
        ComputedFields: never;
        Relationships: [{ foreignKeyName: "account_moderation_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      moderation_events: {
        Row: { id: string; actor_id: string; owner_id: string; target_type: string; target_id: string; action: string; reason: string; created_at: string };
        Insert: { id?: string; actor_id: string; owner_id: string; target_type: string; target_id: string; action: string; reason: string; created_at?: string };
        Update: { reason?: string };
        ComputedFields: never;
        Relationships: [];
      };
      applications: {
        Row: {
          cover_message: string;
          created_at: string;
          estimated_delivery_days: number | null;
          id: string;
          project_id: string;
          proposed_price: number | null;
          provider_id: string;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cover_message: string;
          created_at?: string;
          estimated_delivery_days?: number | null;
          id?: string;
          project_id: string;
          proposed_price?: number | null;
          provider_id: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Update: {
          cover_message?: string;
          created_at?: string;
          estimated_delivery_days?: number | null;
          id?: string;
          project_id?: string;
          proposed_price?: number | null;
          provider_id?: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_rate_limits: {
        Row: {
          attempt_count: number;
          blocked_until: string | null;
          created_at: string;
          key_hash: string;
          scope: string;
          updated_at: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          attempt_count?: number;
          blocked_until?: string | null;
          created_at?: string;
          key_hash: string;
          scope: string;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          attempt_count?: number;
          blocked_until?: string | null;
          created_at?: string;
          key_hash?: string;
          scope?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      business_domains: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_profiles: {
        Row: {
          business_description: string | null;
          business_name: string;
          business_tax_id: string | null;
          business_type: string | null;
          business_type_text: string | null;
          company_size: string | null;
          created_at: string;
          id: string;
          interested_solution_other_text: string | null;
          interested_solution_types: string[];
          preferred_language: string | null;
          project_idea: string | null;
          target_market_text: string | null;
          user_id: string;
          website_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          business_description?: string | null;
          business_name: string;
          business_tax_id?: string | null;
          business_type?: string | null;
          business_type_text?: string | null;
          company_size?: string | null;
          created_at?: string;
          id?: string;
          interested_solution_other_text?: string | null;
          interested_solution_types?: string[];
          preferred_language?: string | null;
          project_idea?: string | null;
          target_market_text?: string | null;
          user_id: string;
          website_url?: string | null;
        };
        Update: {
          business_description?: string | null;
          business_name?: string;
          business_tax_id?: string | null;
          business_type?: string | null;
          business_type_text?: string | null;
          company_size?: string | null;
          created_at?: string;
          id?: string;
          interested_solution_other_text?: string | null;
          interested_solution_types?: string[];
          preferred_language?: string | null;
          project_idea?: string | null;
          target_market_text?: string | null;
          user_id?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          source_deleted_at: string | null;
          source_title: string | null;
          application_id: string | null;
          client_id: string;
          created_at: string;
          id: string;
          project_id: string | null;
          provider_id: string;
          service_request_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          client_id: string;
          created_at?: string;
          id?: string;
          project_id?: string | null;
          provider_id: string;
          service_request_id?: string | null;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          client_id?: string;
          created_at?: string;
          id?: string;
          project_id?: string | null;
          provider_id?: string;
          service_request_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "provider_service_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_tags: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          matched_at: string;
          notes: string | null;
          project_id: string;
          provider_profile_id: string;
          score: number;
          score_breakdown: NonNullable<Json>;
          status: Database["public"]["Enums"]["match_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          matched_at?: string;
          notes?: string | null;
          project_id: string;
          provider_profile_id: string;
          score: number;
          score_breakdown?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
        };
        Update: {
          id?: string;
          matched_at?: string;
          notes?: string | null;
          project_id?: string;
          provider_profile_id?: string;
          score?: number;
          score_breakdown?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          conversation_id: string;
          created_at: string;
          id: string;
          is_read: boolean;
          message_text: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text: string;
          sender_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      project_categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      project_goals: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_request_features: {
        Row: {
          created_at: string;
          feature_id: string;
          notes: string | null;
          priority: number;
          project_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feature_id: string;
          notes?: string | null;
          priority?: number;
          project_id: string;
        };
        Update: {
          created_at?: string;
          feature_id?: string;
          notes?: string | null;
          priority?: number;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_request_features_feature_id_fkey";
            columns: ["feature_id"];
            isOneToOne: false;
            referencedRelation: "feature_tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_request_features_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_request_goals: {
        Row: {
          created_at: string;
          goal_id: string;
          project_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          goal_id: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          goal_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_request_goals_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "project_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_request_goals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          is_hidden: boolean;
          budget_max: number | null;
          budget_min: number | null;
          budget_type: Database["public"]["Enums"]["budget_type"];
          business_context_text: string | null;
          business_domain_id: string | null;
          business_domain_other_text: string | null;
          business_industry: string | null;
          category_id: string | null;
          client_id: string;
          created_at: string;
          deadline_date: string | null;
          deadline_type: Database["public"]["Enums"]["deadline_type"];
          description: string;
          desired_start_date: string | null;
          discovery_notes: string | null;
          estimated_pages: number | null;
          existing_website_url: string | null;
          goal: string | null;
          goal_other_text: string | null;
          has_existing_website: boolean;
          id: string;
          is_featured: boolean;
          is_remote_friendly: boolean;
          needs_content_writing: boolean;
          needs_design: boolean;
          needs_seo: boolean;
          preferred_language: string | null;
          preferred_provider_type: Database["public"]["Enums"]["preferred_provider_type"];
          readiness_level: Database["public"]["Enums"]["project_readiness_level"] | null;
          scope_level: Database["public"]["Enums"]["project_scope_level"] | null;
          service_type_id: string | null;
          slug: string;
          status: Database["public"]["Enums"]["project_status"];
          success_criteria_text: string | null;
          target_audience_text: string | null;
          title: string;
          updated_at: string;
          what_do_you_need_text: string | null;
        };
        ComputedFields: never;
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: Database["public"]["Enums"]["budget_type"];
          business_context_text?: string | null;
          business_domain_id?: string | null;
          business_domain_other_text?: string | null;
          business_industry?: string | null;
          category_id?: string | null;
          client_id: string;
          created_at?: string;
          deadline_date?: string | null;
          deadline_type?: Database["public"]["Enums"]["deadline_type"];
          description: string;
          desired_start_date?: string | null;
          discovery_notes?: string | null;
          estimated_pages?: number | null;
          existing_website_url?: string | null;
          goal?: string | null;
          goal_other_text?: string | null;
          has_existing_website?: boolean;
          id?: string;
          is_featured?: boolean;
          is_remote_friendly?: boolean;
          needs_content_writing?: boolean;
          needs_design?: boolean;
          needs_seo?: boolean;
          preferred_language?: string | null;
          preferred_provider_type?: Database["public"]["Enums"]["preferred_provider_type"];
          readiness_level?: Database["public"]["Enums"]["project_readiness_level"] | null;
          scope_level?: Database["public"]["Enums"]["project_scope_level"] | null;
          service_type_id?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["project_status"];
          success_criteria_text?: string | null;
          target_audience_text?: string | null;
          title: string;
          updated_at?: string;
          what_do_you_need_text?: string | null;
        };
        Update: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: Database["public"]["Enums"]["budget_type"];
          business_context_text?: string | null;
          business_domain_id?: string | null;
          business_domain_other_text?: string | null;
          business_industry?: string | null;
          category_id?: string | null;
          client_id?: string;
          created_at?: string;
          deadline_date?: string | null;
          deadline_type?: Database["public"]["Enums"]["deadline_type"];
          description?: string;
          desired_start_date?: string | null;
          discovery_notes?: string | null;
          estimated_pages?: number | null;
          existing_website_url?: string | null;
          goal?: string | null;
          goal_other_text?: string | null;
          has_existing_website?: boolean;
          id?: string;
          is_featured?: boolean;
          is_remote_friendly?: boolean;
          needs_content_writing?: boolean;
          needs_design?: boolean;
          needs_seo?: boolean;
          preferred_language?: string | null;
          preferred_provider_type?: Database["public"]["Enums"]["preferred_provider_type"];
          readiness_level?: Database["public"]["Enums"]["project_readiness_level"] | null;
          scope_level?: Database["public"]["Enums"]["project_scope_level"] | null;
          service_type_id?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["project_status"];
          success_criteria_text?: string | null;
          target_audience_text?: string | null;
          title?: string;
          updated_at?: string;
          what_do_you_need_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_business_domain_id_fkey";
            columns: ["business_domain_id"];
            isOneToOne: false;
            referencedRelation: "business_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "project_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_business_domains: {
        Row: {
          business_domain_id: string;
          created_at: string;
          provider_profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_domain_id: string;
          created_at?: string;
          provider_profile_id: string;
        };
        Update: {
          business_domain_id?: string;
          created_at?: string;
          provider_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_business_domains_business_domain_id_fkey";
            columns: ["business_domain_id"];
            isOneToOne: false;
            referencedRelation: "business_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_business_domains_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_feature_capabilities: {
        Row: {
          created_at: string;
          feature_id: string;
          provider_profile_id: string;
          strength: Database["public"]["Enums"]["capability_strength"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feature_id: string;
          provider_profile_id: string;
          strength?: Database["public"]["Enums"]["capability_strength"];
        };
        Update: {
          created_at?: string;
          feature_id?: string;
          provider_profile_id?: string;
          strength?: Database["public"]["Enums"]["capability_strength"];
        };
        Relationships: [
          {
            foreignKeyName: "provider_feature_capabilities_feature_id_fkey";
            columns: ["feature_id"];
            isOneToOne: false;
            referencedRelation: "feature_tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_feature_capabilities_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_goal_focuses: {
        Row: {
          created_at: string;
          goal_id: string;
          provider_profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          goal_id: string;
          provider_profile_id: string;
        };
        Update: {
          created_at?: string;
          goal_id?: string;
          provider_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_goal_focuses_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "project_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_goal_focuses_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_languages: {
        Row: {
          created_at: string;
          id: string;
          is_primary: boolean;
          language_code: string;
          language_name: string;
          provider_profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          language_code: string;
          language_name: string;
          provider_profile_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          language_code?: string;
          language_name?: string;
          provider_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_languages_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_profiles: {
        Row: {
          about: string | null;
          availability: Database["public"]["Enums"]["availability_status"];
          average_rating: number;
          bio: string | null;
          business_domain_other_text: string | null;
          company_name: string | null;
          created_at: string;
          display_name: string | null;
          fixed_price_max: number | null;
          fixed_price_min: number | null;
          headline: string | null;
          hourly_rate_max: number | null;
          hourly_rate_min: number | null;
          id: string;
          ideal_client_text: string | null;
          industries_text: string | null;
          is_verified: boolean;
          portfolio_url: string | null;
          preferred_scope: Database["public"]["Enums"]["project_scope_level"] | null;
          project_budget_max: number | null;
          project_budget_min: number | null;
          provider_type: Database["public"]["Enums"]["provider_type"];
          service_categories: Database["public"]["Enums"]["provider_service_category"][];
          service_category_other_text: string | null;
          services_text: string | null;
          social_link: string | null;
          tax_id: string | null;
          team_size: number | null;
          tech_capabilities_text: string | null;
          total_reviews: number;
          updated_at: string;
          user_id: string;
          years_of_experience: number | null;
        };
        ComputedFields: never;
        Insert: {
          about?: string | null;
          availability?: Database["public"]["Enums"]["availability_status"];
          average_rating?: number;
          bio?: string | null;
          business_domain_other_text?: string | null;
          company_name?: string | null;
          created_at?: string;
          display_name?: string | null;
          fixed_price_max?: number | null;
          fixed_price_min?: number | null;
          headline?: string | null;
          hourly_rate_max?: number | null;
          hourly_rate_min?: number | null;
          id?: string;
          ideal_client_text?: string | null;
          industries_text?: string | null;
          is_verified?: boolean;
          portfolio_url?: string | null;
          preferred_scope?: Database["public"]["Enums"]["project_scope_level"] | null;
          project_budget_max?: number | null;
          project_budget_min?: number | null;
          provider_type: Database["public"]["Enums"]["provider_type"];
          service_categories?: Database["public"]["Enums"]["provider_service_category"][];
          service_category_other_text?: string | null;
          services_text?: string | null;
          social_link?: string | null;
          tax_id?: string | null;
          team_size?: number | null;
          tech_capabilities_text?: string | null;
          total_reviews?: number;
          updated_at?: string;
          user_id: string;
          years_of_experience?: number | null;
        };
        Update: {
          about?: string | null;
          availability?: Database["public"]["Enums"]["availability_status"];
          average_rating?: number;
          bio?: string | null;
          business_domain_other_text?: string | null;
          company_name?: string | null;
          created_at?: string;
          display_name?: string | null;
          fixed_price_max?: number | null;
          fixed_price_min?: number | null;
          headline?: string | null;
          hourly_rate_max?: number | null;
          hourly_rate_min?: number | null;
          id?: string;
          ideal_client_text?: string | null;
          industries_text?: string | null;
          is_verified?: boolean;
          portfolio_url?: string | null;
          preferred_scope?: Database["public"]["Enums"]["project_scope_level"] | null;
          project_budget_max?: number | null;
          project_budget_min?: number | null;
          provider_type?: Database["public"]["Enums"]["provider_type"];
          service_categories?: Database["public"]["Enums"]["provider_service_category"][];
          service_category_other_text?: string | null;
          services_text?: string | null;
          social_link?: string | null;
          tax_id?: string | null;
          team_size?: number | null;
          tech_capabilities_text?: string | null;
          total_reviews?: number;
          updated_at?: string;
          user_id?: string;
          years_of_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "provider_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_service_listings: {
        Row: {
          is_hidden: boolean;
          category_id: string | null;
          category_text: string | null;
          created_at: string;
          delivery_bucket: Database["public"]["Enums"]["provider_service_delivery_bucket"];
          delivery_estimate: string | null;
          description: string;
          id: string;
          price_type: Database["public"]["Enums"]["provider_service_price_type"];
          provider_id: string;
          published_at: string | null;
          service_type_id: string | null;
          service_type_text: string | null;
          starting_price: number | null;
          status: Database["public"]["Enums"]["provider_service_listing_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          category_text?: string | null;
          created_at?: string;
          delivery_bucket?: Database["public"]["Enums"]["provider_service_delivery_bucket"];
          delivery_estimate?: string | null;
          description: string;
          id?: string;
          price_type?: Database["public"]["Enums"]["provider_service_price_type"];
          provider_id: string;
          published_at?: string | null;
          service_type_id?: string | null;
          service_type_text?: string | null;
          starting_price?: number | null;
          status?: Database["public"]["Enums"]["provider_service_listing_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          category_text?: string | null;
          created_at?: string;
          delivery_bucket?: Database["public"]["Enums"]["provider_service_delivery_bucket"];
          delivery_estimate?: string | null;
          description?: string;
          id?: string;
          price_type?: Database["public"]["Enums"]["provider_service_price_type"];
          provider_id?: string;
          published_at?: string | null;
          service_type_id?: string | null;
          service_type_text?: string | null;
          starting_price?: number | null;
          status?: Database["public"]["Enums"]["provider_service_listing_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_service_listings_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "project_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_service_listings_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_service_listings_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_service_requests: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          message: string;
          provider_id: string;
          service_id: string;
          status: Database["public"]["Enums"]["provider_service_request_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          message: string;
          provider_id: string;
          service_id: string;
          status?: Database["public"]["Enums"]["provider_service_request_status"];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
          provider_id?: string;
          service_id?: string;
          status?: Database["public"]["Enums"]["provider_service_request_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_service_requests_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_service_requests_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_service_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "provider_service_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_service_types: {
        Row: {
          created_at: string;
          provider_profile_id: string;
          service_type_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          provider_profile_id: string;
          service_type_id: string;
        };
        Update: {
          created_at?: string;
          provider_profile_id?: string;
          service_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_service_types_provider_profile_id_fkey";
            columns: ["provider_profile_id"];
            isOneToOne: false;
            referencedRelation: "provider_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_service_types_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "service_types";
            referencedColumns: ["id"];
          },
        ];
      };
      service_types: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_types_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "project_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      service_workrooms: {
        Row: {
          accepted_at: string;
          client_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          provider_id: string;
          service_id: string;
          service_request_id: string;
          status: Database["public"]["Enums"]["service_workroom_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          client_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          provider_id: string;
          service_id: string;
          service_request_id: string;
          status?: Database["public"]["Enums"]["service_workroom_status"];
          updated_at?: string;
        };
        Update: {
          accepted_at?: string;
          client_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          provider_id?: string;
          service_id?: string;
          service_request_id?: string;
          status?: Database["public"]["Enums"]["service_workroom_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_workrooms_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_workrooms_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_workrooms_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "provider_service_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_workrooms_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "provider_service_requests";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_account_enabled: { Args: { target_user_id: string }; Returns: boolean };
      can_send_conversation_message: { Args: { target_conversation_id: string }; Returns: boolean };
      before_user_created_moderation: { Args: { event: Json }; Returns: Json };
      admin_moderate_listing: { Args: { target_type: string; target_id: string; decision: string; reason: string }; Returns: Json };
      admin_moderate_user: { Args: { target_user_id: string; decision: string; reason: string; suspension_end?: string | null }; Returns: Json };
      admin_confirm_auth_deleted: { Args: { target_user_id: string }; Returns: undefined };
      admin_list_records: { Args: { resource: string; page_number?: number; filter_value?: string }; Returns: Json };
      admin_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      accept_project_application: {
        Args: { target_application_id: string };
        Returns: {
          application_id: string;
          application_status: Database["public"]["Enums"]["application_status"];
          conversation_id: string;
        }[];
      };
      accept_provider_service_request: {
        Args: { target_request_id: string };
        Returns: {
          conversation_id: string;
          request_id: string;
          request_status: Database["public"]["Enums"]["provider_service_request_status"];
          workroom_id: string;
        }[];
      };
      auth_rate_limit_check: {
        Args: { target_key_hash: string; target_scope: string };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
      auth_rate_limit_record_attempt: {
        Args: {
          block_seconds: number;
          max_attempts: number;
          target_key_hash: string;
          target_scope: string;
          window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
      auth_rate_limit_reset: {
        Args: { target_key_hash: string; target_scope: string };
        Returns: undefined;
      };
      cancel_provider_service_request: {
        Args: { target_request_id: string };
        Returns: {
          conversation_id: string;
          request_id: string;
          request_status: Database["public"]["Enums"]["provider_service_request_status"];
        }[];
      };
      complete_service_workroom: {
        Args: { target_workroom_id: string };
        Returns: {
          workroom_id: string;
          workroom_status: Database["public"]["Enums"]["service_workroom_status"];
        }[];
      };
      get_own_contact_details: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          phone: string;
        }[];
      };
      get_own_provider_tax_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      get_public_profile: { Args: { target_user_id: string }; Returns: Json | null };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_conversation_participant: { Args: { target_conversation_id: string }; Returns: boolean };
      owns_project: { Args: { target_project_id: string }; Returns: boolean };
      owns_provider_profile: { Args: { target_provider_profile_id: string }; Returns: boolean };
      provider_has_application_for_project: {
        Args: { target_project_id: string; target_provider_id: string };
        Returns: boolean;
      };
      reject_project_application: {
        Args: { target_application_id: string };
        Returns: {
          application_id: string;
          application_status: Database["public"]["Enums"]["application_status"];
          project_id: string;
          project_status: Database["public"]["Enums"]["project_status"];
        }[];
      };
      reject_provider_service_request: {
        Args: { target_request_id: string };
        Returns: {
          conversation_id: string;
          request_id: string;
          request_status: Database["public"]["Enums"]["provider_service_request_status"];
        }[];
      };
      request_provider_service: {
        Args: { request_message: string; target_service_id: string };
        Returns: {
          conversation_id: string;
          request_id: string;
          request_status: Database["public"]["Enums"]["provider_service_request_status"];
        }[];
      };
      withdraw_project_application: {
        Args: { target_application_id: string };
        Returns: {
          application_id: string;
          application_status: Database["public"]["Enums"]["application_status"];
          project_id: string;
          project_status: Database["public"]["Enums"]["project_status"];
        }[];
      };
    };
    Enums: {
      application_status:
        | "pending"
        | "viewed"
        | "shortlisted"
        | "rejected"
        | "accepted"
        | "withdrawn";
      availability_status: "available" | "busy" | "unavailable";
      budget_type: "fixed" | "range" | "negotiable";
      capability_strength: "basic" | "strong" | "expert";
      deadline_type: "specific_date" | "flexible" | "asap";
      match_status: "suggested" | "viewed" | "contacted" | "accepted" | "rejected" | "archived";
      preferred_provider_type: "freelancer" | "agency" | "studio" | "any";
      project_readiness_level:
        | "idea_only"
        | "need_guidance"
        | "content_ready"
        | "design_ready"
        | "spec_ready";
      project_scope_level: "small" | "medium" | "large";
      project_status:
        | "draft"
        | "published"
        | "in_discussion"
        | "assigned"
        | "completed"
        | "cancelled";
      provider_service_category:
        | "web_development"
        | "mobile_development"
        | "ui_ux_design"
        | "graphic_design"
        | "video_editing"
        | "seo"
        | "marketing"
        | "copywriting"
        | "branding"
        | "ecommerce"
        | "automation"
        | "other";
      provider_service_delivery_bucket:
        | "urgent_24h"
        | "up_to_3_days"
        | "up_to_1_week"
        | "up_to_2_weeks"
        | "up_to_1_month"
        | "flexible";
      provider_service_listing_status: "draft" | "published" | "paused";
      provider_service_price_type: "fixed" | "hourly" | "starting_at" | "negotiable";
      provider_service_request_status: "pending" | "accepted" | "rejected" | "cancelled";
      provider_type: "freelancer" | "agency" | "studio" | "company" | "other";
      service_workroom_status: "active" | "completed";
      user_role: "client" | "provider" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      application_status: ["pending", "viewed", "shortlisted", "rejected", "accepted", "withdrawn"],
      availability_status: ["available", "busy", "unavailable"],
      budget_type: ["fixed", "range", "negotiable"],
      capability_strength: ["basic", "strong", "expert"],
      deadline_type: ["specific_date", "flexible", "asap"],
      match_status: ["suggested", "viewed", "contacted", "accepted", "rejected", "archived"],
      preferred_provider_type: ["freelancer", "agency", "studio", "any"],
      project_readiness_level: [
        "idea_only",
        "need_guidance",
        "content_ready",
        "design_ready",
        "spec_ready",
      ],
      project_scope_level: ["small", "medium", "large"],
      project_status: ["draft", "published", "in_discussion", "assigned", "completed", "cancelled"],
      provider_service_category: [
        "web_development",
        "mobile_development",
        "ui_ux_design",
        "graphic_design",
        "video_editing",
        "seo",
        "marketing",
        "copywriting",
        "branding",
        "ecommerce",
        "automation",
        "other",
      ],
      provider_service_delivery_bucket: [
        "urgent_24h",
        "up_to_3_days",
        "up_to_1_week",
        "up_to_2_weeks",
        "up_to_1_month",
        "flexible",
      ],
      provider_service_listing_status: ["draft", "published", "paused"],
      provider_service_price_type: ["fixed", "hourly", "starting_at", "negotiable"],
      provider_service_request_status: ["pending", "accepted", "rejected", "cancelled"],
      provider_type: ["freelancer", "agency", "studio", "company", "other"],
      service_workroom_status: ["active", "completed"],
      user_role: ["client", "provider", "admin"],
    },
  },
} as const;
