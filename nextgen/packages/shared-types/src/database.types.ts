export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accommodations: {
        Row: {
          address: string | null
          booking_ref: string | null
          cancellation_deadline: string | null
          check_in: string | null
          check_out: string | null
          cost: number | null
          created_at: string
          currency: string | null
          day_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          payment_deadline: string | null
          trip_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          booking_ref?: string | null
          cancellation_deadline?: string | null
          check_in?: string | null
          check_out?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          day_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          payment_deadline?: string | null
          trip_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          booking_ref?: string | null
          cancellation_deadline?: string | null
          check_in?: string | null
          check_out?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          day_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          payment_deadline?: string | null
          trip_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          address: string | null
          booking_ref: string | null
          cost: number | null
          created_at: string
          currency: string | null
          date: string | null
          day_id: string | null
          duration_min: number | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          sort_order: number
          ticket_url: string | null
          time: string | null
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_ref?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          date?: string | null
          day_id?: string | null
          duration_min?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          sort_order?: number
          ticket_url?: string | null
          time?: string | null
          trip_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_ref?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          date?: string | null
          day_id?: string | null
          duration_min?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          sort_order?: number
          ticket_url?: string | null
          time?: string | null
          trip_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          call_type: string
          created_at: string
          date: string
          id: string
          tokens: number | null
          user_id: string
        }
        Insert: {
          call_type: string
          created_at?: string
          date?: string
          id?: string
          tokens?: number | null
          user_id: string
        }
        Update: {
          call_type?: string
          created_at?: string
          date?: string
          id?: string
          tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      baggage_items: {
        Row: {
          category: string
          created_at: string
          height_cm: number | null
          id: string
          label: string | null
          leg_id: string | null
          length_cm: number | null
          notes: string | null
          trip_id: string
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          category: string
          created_at?: string
          height_cm?: number | null
          id?: string
          label?: string | null
          leg_id?: string | null
          length_cm?: number | null
          notes?: string | null
          trip_id: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          height_cm?: number | null
          id?: string
          label?: string | null
          leg_id?: string | null
          length_cm?: number | null
          notes?: string | null
          trip_id?: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "baggage_items_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baggage_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          base_currency: string
          created_at: string
          fetched_at: string
          id: string
          rates: Json
        }
        Insert: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rates: Json
        }
        Update: {
          base_currency?: string
          created_at?: string
          fetched_at?: string
          id?: string
          rates?: Json
        }
        Relationships: []
      }
      days: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          sort_order: number
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          sort_order?: number
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          sort_order?: number
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_cache: {
        Row: {
          briefing: Json
          created_at: string
          destination: string
          fetched_at: string
          id: string
        }
        Insert: {
          briefing: Json
          created_at?: string
          destination: string
          fetched_at?: string
          id?: string
        }
        Update: {
          briefing?: Json
          created_at?: string
          destination?: string
          fetched_at?: string
          id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          barcode_data: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          file_path: string | null
          file_type: string
          file_url: string | null
          id: string
          notes: string | null
          title: string
          trip_id: string
          type: string
          updated_at: string
          uploaded_by: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          barcode_data?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          file_path?: string | null
          file_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          title: string
          trip_id: string
          type: string
          updated_at?: string
          uploaded_by: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          barcode_data?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          file_path?: string | null
          file_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          title?: string
          trip_id?: string
          type?: string
          updated_at?: string
          uploaded_by?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          amount_eur: number | null
          category: string
          created_at: string
          currency: string
          date: string | null
          day_id: string | null
          description: string
          id: string
          notes: string | null
          paid_by: string
          split: boolean
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_eur?: number | null
          category: string
          created_at?: string
          currency?: string
          date?: string | null
          day_id?: string | null
          description: string
          id?: string
          notes?: string | null
          paid_by: string
          split?: boolean
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_eur?: number | null
          category?: string
          created_at?: string
          currency?: string
          date?: string | null
          day_id?: string | null
          description?: string
          id?: string
          notes?: string | null
          paid_by?: string
          split?: boolean
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_controls: {
        Row: {
          alert_thresholds: number[]
          alerted_thresholds: number[]
          daily_usage: number
          enabled: boolean
          feature_key: string
          hard_daily_cap: number | null
          updated_at: string
          updated_by: string | null
          usage_date: string
        }
        Insert: {
          alert_thresholds?: number[]
          alerted_thresholds?: number[]
          daily_usage?: number
          enabled?: boolean
          feature_key: string
          hard_daily_cap?: number | null
          updated_at?: string
          updated_by?: string | null
          usage_date?: string
        }
        Update: {
          alert_thresholds?: number[]
          alerted_thresholds?: number[]
          daily_usage?: number
          enabled?: boolean
          feature_key?: string
          hard_daily_cap?: number | null
          updated_at?: string
          updated_by?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_controls_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_entitlements: {
        Row: {
          created_at: string
          daily_limit: number | null
          enabled: boolean
          feature_key: string
          id: string
          monthly_limit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number | null
          enabled?: boolean
          feature_key: string
          id?: string
          monthly_limit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_limit?: number | null
          enabled?: boolean
          feature_key?: string
          id?: string
          monthly_limit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_tokens: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          id: string
          target_id: string
          token: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          id?: string
          target_id: string
          token: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          target_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_tokens_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_tokens_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_exports: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
          error: string | null
          expires_at: string | null
          hashtags: string[] | null
          id: string
          media_ids: string[]
          options: Json | null
          status: string
          template: string | null
          trip_id: string
          type: string
          updated_at: string
          zip_path: string | null
          zip_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          expires_at?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids: string[]
          options?: Json | null
          status?: string
          template?: string | null
          trip_id: string
          type: string
          updated_at?: string
          zip_path?: string | null
          zip_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          expires_at?: string | null
          hashtags?: string[] | null
          id?: string
          media_ids?: string[]
          options?: Json | null
          status?: string
          template?: string | null
          trip_id?: string
          type?: string
          updated_at?: string
          zip_path?: string | null
          zip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_exports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      legs: {
        Row: {
          arrival_at: string | null
          boarding_pass_path: string | null
          boarding_pass_url: string | null
          booking_ref: string | null
          carrier: string | null
          checkin_opens_at: string | null
          cost: number | null
          created_at: string
          currency: string | null
          day_id: string | null
          departure_at: string | null
          duration_min: number | null
          from_lat: number | null
          from_lng: number | null
          from_name: string
          id: string
          notes: string | null
          pnr: string | null
          sort_order: number
          to_lat: number | null
          to_lng: number | null
          to_name: string
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          arrival_at?: string | null
          boarding_pass_path?: string | null
          boarding_pass_url?: string | null
          booking_ref?: string | null
          carrier?: string | null
          checkin_opens_at?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          day_id?: string | null
          departure_at?: string | null
          duration_min?: number | null
          from_lat?: number | null
          from_lng?: number | null
          from_name: string
          id?: string
          notes?: string | null
          pnr?: string | null
          sort_order?: number
          to_lat?: number | null
          to_lng?: number | null
          to_name: string
          trip_id: string
          type: string
          updated_at?: string
        }
        Update: {
          arrival_at?: string | null
          boarding_pass_path?: string | null
          boarding_pass_url?: string | null
          booking_ref?: string | null
          carrier?: string | null
          checkin_opens_at?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          day_id?: string | null
          departure_at?: string | null
          duration_min?: number | null
          from_lat?: number | null
          from_lng?: number | null
          from_name?: string
          id?: string
          notes?: string | null
          pnr?: string | null
          sort_order?: number
          to_lat?: number | null
          to_lng?: number | null
          to_name?: string
          trip_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legs_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          camera: string | null
          caption: string | null
          created_at: string
          day_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          height: number | null
          id: string
          mime_type: string | null
          size: number | null
          sort_order: number
          storage_path: string | null
          tags: string[] | null
          taken_at: string | null
          thumb_path: string | null
          thumbnail_url: string | null
          trip_id: string
          updated_at: string
          uploaded_by: string
          url: string | null
          width: number | null
        }
        Insert: {
          camera?: string | null
          caption?: string | null
          created_at?: string
          day_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          size?: number | null
          sort_order?: number
          storage_path?: string | null
          tags?: string[] | null
          taken_at?: string | null
          thumb_path?: string | null
          thumbnail_url?: string | null
          trip_id: string
          updated_at?: string
          uploaded_by: string
          url?: string | null
          width?: number | null
        }
        Update: {
          camera?: string | null
          caption?: string | null
          created_at?: string
          day_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          size?: number | null
          sort_order?: number
          storage_path?: string | null
          tags?: string[] | null
          taken_at?: string | null
          thumb_path?: string | null
          thumbnail_url?: string | null
          trip_id?: string
          updated_at?: string
          uploaded_by?: string
          url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_checklists: {
        Row: {
          checked_item_ids: string[]
          generated_at: string | null
          input_hash: string | null
          items: Json
          trip_id: string
          updated_at: string
          weather_snapshot: Json | null
        }
        Insert: {
          checked_item_ids?: string[]
          generated_at?: string | null
          input_hash?: string | null
          items?: Json
          trip_id: string
          updated_at?: string
          weather_snapshot?: Json | null
        }
        Update: {
          checked_item_ids?: string[]
          generated_at?: string | null
          input_hash?: string | null
          items?: Json
          trip_id?: string
          updated_at?: string
          weather_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_checklists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content_json: Json | null
          cover_image: string | null
          created_at: string
          id: string
          og_description: string | null
          published_at: string | null
          reading_time: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content_json?: Json | null
          cover_image?: string | null
          created_at?: string
          id?: string
          og_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content_json?: Json | null
          cover_image?: string | null
          created_at?: string
          id?: string
          og_description?: string | null
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          plan: string
          premium_enabled_at: string | null
          premium_enabled_by: string | null
          premium_until: string | null
          role: string
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          plan?: string
          premium_enabled_at?: string | null
          premium_enabled_by?: string | null
          premium_until?: string | null
          role?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          plan?: string
          premium_enabled_at?: string | null
          premium_enabled_by?: string | null
          premium_until?: string | null
          role?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_premium_enabled_by_fkey"
            columns: ["premium_enabled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          message: string | null
          remind_at: string
          sent_at: string | null
          title: string
          trip_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          message?: string | null
          remind_at: string
          sent_at?: string | null
          title: string
          trip_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string | null
          remind_at?: string
          sent_at?: string | null
          title?: string
          trip_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          booking_ref: string | null
          confirmation_url: string | null
          cost: number | null
          covers: number | null
          created_at: string
          cuisine_type: string | null
          currency: string | null
          date: string | null
          day_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          time: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_ref?: string | null
          confirmation_url?: string | null
          cost?: number | null
          covers?: number | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          date?: string | null
          day_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          time?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_ref?: string | null
          confirmation_url?: string | null
          cost?: number | null
          covers?: number | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          date?: string | null
          day_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          time?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_deletion_queue: {
        Row: {
          bucket_id: string
          created_at: string
          id: number
          name: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      trip_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          token_hash: string
          trip_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          token_hash: string
          trip_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          token_hash?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          id: string
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget_eur: number | null
          cover_image: string | null
          created_at: string
          description: string | null
          destination: string
          end_date: string | null
          id: string
          owner_id: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          budget_eur?: number | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          destination: string
          end_date?: string | null
          id?: string
          owner_id: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget_eur?: number | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          destination?: string
          end_date?: string | null
          id?: string
          owner_id?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          period_start: string
          period_type: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          period_start: string
          period_type: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          period_start?: string
          period_type?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          id: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          id?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
    }
    Views: {
      admin_user_view: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          last_sign_in_at: string | null
          plan: string | null
          premium_enabled_at: string | null
          premium_enabled_by: string | null
          premium_until: string | null
          role: string | null
          suspended_at: string | null
          suspended_reason: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_trip_invite: {
        Args: {
          p_token: string
        }
        Returns: string
      }
      check_rate_limit: {
        Args: {
          p_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          hits: number
          reset_at: string
        }[]
      }
      consume_feature_quota: {
        Args: {
          p_user_id: string
          p_feature: string
          p_counters: Json
          p_amount?: number
        }
        Returns: number
      }
      create_trip: {
        Args: {
          p_title: string
          p_destination: string
          p_start_date?: string
          p_end_date?: string
          p_description?: string
          p_cover_image?: string
        }
        Returns: Database["public"]["Tables"]["trips"]["Row"]
      }
      create_trip_invite: {
        Args: {
          p_trip_id: string
          p_email: string
          p_token_hash: string
        }
        Returns: Database["public"]["Tables"]["trip_invites"]["Row"]
      }
      delete_my_account: {
        Args: {
          confirm_text: string
        }
        Returns: Json
      }
      is_trip_member: {
        Args: {
          trip_id: string
        }
        Returns: boolean
      }
      is_trip_owner: {
        Args: {
          p_trip_id: string
        }
        Returns: boolean
      }
      is_user_trip_member: {
        Args: {
          p_trip_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      prune_rate_limits: {
        Args: never
        Returns: number
      }
      purge_user_data: {
        Args: {
          p_user: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

