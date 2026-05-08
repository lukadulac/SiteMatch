export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
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
          business_type_text: string | null;
          business_type: string | null;
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
        Insert: {
          business_description?: string | null;
          business_name: string;
          business_tax_id?: string | null;
          business_type_text?: string | null;
          business_type?: string | null;
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
          business_type_text?: string | null;
          business_type?: string | null;
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
          application_id: string | null;
          client_id: string;
          created_at: string;
          id: string;
          project_id: string;
          provider_id: string;
          updated_at: string;
        };
        Insert: {
          application_id?: string | null;
          client_id: string;
          created_at?: string;
          id?: string;
          project_id: string;
          provider_id: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          client_id?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
          provider_id?: string;
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
          score_breakdown: Json;
          status: Database["public"]["Enums"]["match_status"];
          updated_at: string;
        };
        Insert: {
          id?: string;
          matched_at?: string;
          notes?: string | null;
          project_id: string;
          provider_profile_id: string;
          score: number;
          score_breakdown?: Json;
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
          score_breakdown?: Json;
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
          budget_max: number | null;
          budget_min: number | null;
          budget_type: Database["public"]["Enums"]["budget_type"];
          business_domain_id: string | null;
          business_domain_other_text: string | null;
          business_context_text: string | null;
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
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: Database["public"]["Enums"]["budget_type"];
          business_domain_id?: string | null;
          business_domain_other_text?: string | null;
          business_context_text?: string | null;
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
          business_domain_id?: string | null;
          business_domain_other_text?: string | null;
          business_context_text?: string | null;
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
          services_text: string | null;
          team_size: number | null;
          tech_capabilities_text: string | null;
          total_reviews: number;
          updated_at: string;
          user_id: string;
          years_of_experience: number | null;
        };
        Insert: {
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
          services_text?: string | null;
          team_size?: number | null;
          tech_capabilities_text?: string | null;
          total_reviews?: number;
          updated_at?: string;
          user_id: string;
          years_of_experience?: number | null;
        };
        Update: {
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
          services_text?: string | null;
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
      provider_service_types: {
        Row: {
          created_at: string;
          provider_profile_id: string;
          service_type_id: string;
        };
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
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
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
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: {
          target_conversation_id: string;
        };
        Returns: boolean;
      };
      owns_project: {
        Args: {
          target_project_id: string;
        };
        Returns: boolean;
      };
      owns_provider_profile: {
        Args: {
          target_provider_profile_id: string;
        };
        Returns: boolean;
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
      match_status:
        | "suggested"
        | "viewed"
        | "contacted"
        | "accepted"
        | "rejected"
        | "archived";
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
      provider_type: "freelancer" | "agency" | "studio";
      user_role: "client" | "provider" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};
