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
          trip_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          booking_ref?: string | null
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
          trip_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          booking_ref?: string | null
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
      instagram_exports: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string
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
          zip_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by: string
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
          zip_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string
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
          tags: string[] | null
          taken_at: string | null
          thumbnail_url: string | null
          trip_id: string
          updated_at: string
          uploaded_by: string
          url: string
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
          tags?: string[] | null
          taken_at?: string | null
          thumbnail_url?: string | null
          trip_id: string
          updated_at?: string
          uploaded_by: string
          url: string
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
          tags?: string[] | null
          taken_at?: string | null
          thumbnail_url?: string | null
          trip_id?: string
          updated_at?: string
          uploaded_by?: string
          url?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_trip_member: { Args: { trip_id: string }; Returns: boolean }
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

