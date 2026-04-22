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
      client_profiles: {
        Row: {
          business_description: string | null;
          business_name: string;
          business_type: string | null;
          company_size: string | null;
          created_at: string;
          id: string;
          preferred_language: string | null;
          user_id: string;
          website_url: string | null;
        };
        Insert: {
          business_description?: string | null;
          business_name: string;
          business_type?: string | null;
          company_size?: string | null;
          created_at?: string;
          id?: string;
          preferred_language?: string | null;
          user_id: string;
          website_url?: string | null;
        };
        Update: {
          business_description?: string | null;
          business_name?: string;
          business_type?: string | null;
          company_size?: string | null;
          created_at?: string;
          id?: string;
          preferred_language?: string | null;
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
      projects: {
        Row: {
          budget_max: number | null;
          budget_min: number | null;
          budget_type: Database["public"]["Enums"]["budget_type"];
          business_industry: string | null;
          category_id: string | null;
          client_id: string;
          created_at: string;
          deadline_date: string | null;
          deadline_type: Database["public"]["Enums"]["deadline_type"];
          description: string;
          existing_website_url: string | null;
          goal: string | null;
          has_existing_website: boolean;
          id: string;
          is_featured: boolean;
          needs_content_writing: boolean;
          needs_design: boolean;
          needs_seo: boolean;
          preferred_language: string | null;
          preferred_provider_type: Database["public"]["Enums"]["preferred_provider_type"];
          slug: string;
          status: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: Database["public"]["Enums"]["budget_type"];
          business_industry?: string | null;
          category_id?: string | null;
          client_id: string;
          created_at?: string;
          deadline_date?: string | null;
          deadline_type?: Database["public"]["Enums"]["deadline_type"];
          description: string;
          existing_website_url?: string | null;
          goal?: string | null;
          has_existing_website?: boolean;
          id?: string;
          is_featured?: boolean;
          needs_content_writing?: boolean;
          needs_design?: boolean;
          needs_seo?: boolean;
          preferred_language?: string | null;
          preferred_provider_type?: Database["public"]["Enums"]["preferred_provider_type"];
          slug: string;
          status?: Database["public"]["Enums"]["project_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: Database["public"]["Enums"]["budget_type"];
          business_industry?: string | null;
          category_id?: string | null;
          client_id?: string;
          created_at?: string;
          deadline_date?: string | null;
          deadline_type?: Database["public"]["Enums"]["deadline_type"];
          description?: string;
          existing_website_url?: string | null;
          goal?: string | null;
          has_existing_website?: boolean;
          id?: string;
          is_featured?: boolean;
          needs_content_writing?: boolean;
          needs_design?: boolean;
          needs_seo?: boolean;
          preferred_language?: string | null;
          preferred_provider_type?: Database["public"]["Enums"]["preferred_provider_type"];
          slug?: string;
          status?: Database["public"]["Enums"]["project_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
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
        ];
      };
      provider_profiles: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"];
          average_rating: number;
          bio: string | null;
          created_at: string;
          fixed_price_max: number | null;
          fixed_price_min: number | null;
          headline: string | null;
          hourly_rate_max: number | null;
          hourly_rate_min: number | null;
          id: string;
          is_verified: boolean;
          portfolio_url: string | null;
          provider_type: Database["public"]["Enums"]["provider_type"];
          total_reviews: number;
          updated_at: string;
          user_id: string;
          years_of_experience: number | null;
        };
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"];
          average_rating?: number;
          bio?: string | null;
          created_at?: string;
          fixed_price_max?: number | null;
          fixed_price_min?: number | null;
          headline?: string | null;
          hourly_rate_max?: number | null;
          hourly_rate_min?: number | null;
          id?: string;
          is_verified?: boolean;
          portfolio_url?: string | null;
          provider_type: Database["public"]["Enums"]["provider_type"];
          total_reviews?: number;
          updated_at?: string;
          user_id: string;
          years_of_experience?: number | null;
        };
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"];
          average_rating?: number;
          bio?: string | null;
          created_at?: string;
          fixed_price_max?: number | null;
          fixed_price_min?: number | null;
          headline?: string | null;
          hourly_rate_max?: number | null;
          hourly_rate_min?: number | null;
          id?: string;
          is_verified?: boolean;
          portfolio_url?: string | null;
          provider_type?: Database["public"]["Enums"]["provider_type"];
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
      deadline_type: "specific_date" | "flexible" | "asap";
      preferred_provider_type: "freelancer" | "agency" | "studio" | "any";
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
