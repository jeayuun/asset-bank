export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  app: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_request: {
        Args: { p_assignee_id: string; p_request_id: string }
        Returns: undefined
      }
      can_edit_collection: {
        Args: { p_collection_id: string }
        Returns: boolean
      }
      can_see_request: { Args: { p_request_id: string }; Returns: boolean }
      change_request_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["request_status"]
          p_note?: string
          p_request_id: string
        }
        Returns: undefined
      }
      collection_member_emails: {
        Args: { p_collection_id: string }
        Returns: {
          email: string
          profile_id: string
        }[]
      }
      commit_import_rows: {
        Args: { p_batch_id: string; p_row_ids: string[] }
        Returns: undefined
      }
      find_profile_id_by_email: { Args: { p_email: string }; Returns: string }
      finish_import_batch: { Args: { p_batch_id: string }; Returns: undefined }
      grant_super_admin: { Args: { p_target: string }; Returns: undefined }
      is_active: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_super: { Args: never; Returns: boolean }
      is_valid_drive_url: { Args: { p_url: string }; Returns: boolean }
      log_sign_in: { Args: never; Returns: undefined }
      merge_taxonomy_term: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      notify: {
        Args: {
          p_actor_id: string
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_recipient_id: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_url: string
        }
        Returns: string
      }
      pending_notification_emails_for_entity: {
        Args: { p_entity_id: string; p_entity_type: string; p_since: string }
        Returns: {
          body: string
          id: string
          recipient_email: string
          title: string
          url: string
        }[]
      }
      profile: {
        Args: never
        Returns: Database["app"]["CompositeTypes"]["profile_info"]
        SetofOptions: {
          from: "*"
          to: "profile_info"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reactivate_user: { Args: { p_target: string }; Returns: undefined }
      record_notification_email_result: {
        Args: {
          p_error?: string
          p_notification_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      request_participant_emails: {
        Args: { p_request_id: string }
        Returns: {
          email: string
          profile_id: string
        }[]
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["role_enum"]
          p_target: string
        }
        Returns: undefined
      }
      suspend_user: { Args: { p_target: string }; Returns: undefined }
      uid: { Args: never; Returns: string }
      unrecognized_sign_ins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
        }[]
      }
      write_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_changed_fields?: string[]
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      profile_info: {
        role: Database["public"]["Enums"]["role_enum"] | null
        status: Database["public"]["Enums"]["profile_status"] | null
      }
    }
  }
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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_grades: {
        Row: {
          asset_id: string
          grade_id: string
        }
        Insert: {
          asset_id: string
          grade_id: string
        }
        Update: {
          asset_id?: string
          grade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_grades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_grades_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_key_stages: {
        Row: {
          asset_id: string
          key_stage_id: string
        }
        Insert: {
          asset_id: string
          key_stage_id: string
        }
        Update: {
          asset_id?: string
          key_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_key_stages_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_key_stages_key_stage_id_fkey"
            columns: ["key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_lessons: {
        Row: {
          added_by: string | null
          asset_id: string
          created_at: string
          lesson_id: string
        }
        Insert: {
          added_by?: string | null
          asset_id: string
          created_at?: string
          lesson_id: string
        }
        Update: {
          added_by?: string | null
          asset_id?: string
          created_at?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_lessons_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_lessons_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_requests: {
        Row: {
          asset_type_id: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          description: string | null
          grade_id: string | null
          id: string
          key_stage_id: string | null
          lesson_id: string | null
          needed_by: string | null
          priority: Database["public"]["Enums"]["request_priority"]
          reference: string
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          asset_type_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          description?: string | null
          grade_id?: string | null
          id?: string
          key_stage_id?: string | null
          lesson_id?: string | null
          needed_by?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          reference: string
          requested_by: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          asset_type_id?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          description?: string | null
          grade_id?: string | null
          id?: string
          key_stage_id?: string | null
          lesson_id?: string | null
          needed_by?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          reference?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_requests_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_requests_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_requests_key_stage_id_fkey"
            columns: ["key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_requests_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_tags: {
        Row: {
          asset_id: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_tags_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_taxonomy_terms: {
        Row: {
          asset_id: string
          taxonomy_term_id: string
        }
        Insert: {
          asset_id: string
          taxonomy_term_id: string
        }
        Update: {
          asset_id?: string
          taxonomy_term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_taxonomy_terms_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_taxonomy_terms_taxonomy_term_id_fkey"
            columns: ["taxonomy_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          allows_video: boolean
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allows_video?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allows_video?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          asset_type_id: string
          character_profile_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          drive_eps_file_id: string | null
          drive_eps_url: string | null
          drive_mp4_file_id: string | null
          drive_mp4_url: string | null
          drive_png_file_id: string | null
          drive_png_url: string | null
          id: string
          preview_bytes: number | null
          preview_height: number | null
          preview_path: string | null
          preview_thumb_path: string | null
          preview_width: number | null
          primary_media: Database["public"]["Enums"]["media_kind"]
          published_at: string | null
          published_by: string | null
          review_state: Database["public"]["Enums"]["review_state"]
          search_text: string | null
          search_tsv: unknown
          status: Database["public"]["Enums"]["asset_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          asset_type_id: string
          character_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drive_eps_file_id?: string | null
          drive_eps_url?: string | null
          drive_mp4_file_id?: string | null
          drive_mp4_url?: string | null
          drive_png_file_id?: string | null
          drive_png_url?: string | null
          id?: string
          preview_bytes?: number | null
          preview_height?: number | null
          preview_path?: string | null
          preview_thumb_path?: string | null
          preview_width?: number | null
          primary_media?: Database["public"]["Enums"]["media_kind"]
          published_at?: string | null
          published_by?: string | null
          review_state?: Database["public"]["Enums"]["review_state"]
          search_text?: string | null
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["asset_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          asset_type_id?: string
          character_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          drive_eps_file_id?: string | null
          drive_eps_url?: string | null
          drive_mp4_file_id?: string | null
          drive_mp4_url?: string | null
          drive_png_file_id?: string | null
          drive_png_url?: string | null
          id?: string
          preview_bytes?: number | null
          preview_height?: number | null
          preview_path?: string | null
          preview_thumb_path?: string | null
          preview_width?: number | null
          primary_media?: Database["public"]["Enums"]["media_kind"]
          published_at?: string | null
          published_by?: string | null
          review_state?: Database["public"]["Enums"]["review_state"]
          search_text?: string | null
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["asset_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_character_profile_id_fkey"
            columns: ["character_profile_id"]
            isOneToOne: false
            referencedRelation: "character_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["role_enum"] | null
          after: Json | null
          before: Json | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["role_enum"] | null
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["role_enum"] | null
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_profiles: {
        Row: {
          character_group_term_id: string | null
          character_type_term_id: string | null
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gender_term_id: string | null
          grade_id: string
          id: string
          is_active: boolean
          key_stage_id: string
          name: string
          profile_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          character_group_term_id?: string | null
          character_type_term_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gender_term_id?: string | null
          grade_id: string
          id?: string
          is_active?: boolean
          key_stage_id: string
          name: string
          profile_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          character_group_term_id?: string | null
          character_type_term_id?: string | null
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gender_term_id?: string | null
          grade_id?: string
          id?: string
          is_active?: boolean
          key_stage_id?: string
          name?: string
          profile_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_profiles_character_group_term_id_fkey"
            columns: ["character_group_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_character_type_term_id_fkey"
            columns: ["character_type_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_gender_term_id_fkey"
            columns: ["gender_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_key_stage_id_fkey"
            columns: ["key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_by: string | null
          asset_id: string
          collection_id: string
          created_at: string
          position: number
        }
        Insert: {
          added_by?: string | null
          asset_id: string
          collection_id: string
          created_at?: string
          position?: number
        }
        Update: {
          added_by?: string | null
          asset_id?: string
          collection_id?: string
          created_at?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_members: {
        Row: {
          can_edit: boolean
          collection_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          can_edit?: boolean
          collection_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          can_edit?: boolean
          collection_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_members_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["collection_visibility"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["collection_visibility"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["collection_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          asset_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string
          id: string
          key_stage_id: string
          label: string
          number: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_stage_id: string
          label: string
          number: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_stage_id?: string
          label?: string
          number?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_key_stage_id_fkey"
            columns: ["key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          committed_at: string | null
          created_at: string
          error_count: number
          filename: string
          id: string
          kind: Database["public"]["Enums"]["import_kind"]
          options: Json | null
          row_count: number
          status: Database["public"]["Enums"]["import_batch_status"]
          updated_at: string
          uploaded_by: string
          valid_count: number
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          error_count?: number
          filename: string
          id?: string
          kind: Database["public"]["Enums"]["import_kind"]
          options?: Json | null
          row_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          updated_at?: string
          uploaded_by: string
          valid_count?: number
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          error_count?: number
          filename?: string
          id?: string
          kind?: Database["public"]["Enums"]["import_kind"]
          options?: Json | null
          row_count?: number
          status?: Database["public"]["Enums"]["import_batch_status"]
          updated_at?: string
          uploaded_by?: string
          valid_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          asset_id: string | null
          batch_id: string
          created_at: string
          errors: Json | null
          id: string
          normalized: Json | null
          raw: Json
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
        }
        Insert: {
          asset_id?: string | null
          batch_id: string
          created_at?: string
          errors?: Json | null
          id?: string
          normalized?: Json | null
          raw: Json
          row_number: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Update: {
          asset_id?: string | null
          batch_id?: string
          created_at?: string
          errors?: Json | null
          id?: string
          normalized?: Json | null
          raw?: Json
          row_number?: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          created_at: string
          default_key_stage_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["role_enum"]
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          default_key_stage_id?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          default_key_stage_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_default_key_stage_id_fkey"
            columns: ["default_key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_stages: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          grade_id: string
          id: string
          is_active: boolean
          lesson_number: number
          term_id: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          grade_id: string
          id?: string
          is_active?: boolean
          lesson_number: number
          term_id: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          grade_id?: string
          id?: string
          is_active?: boolean
          lesson_number?: number
          term_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          profile_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          profile_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          email?: boolean
          in_app?: boolean
          profile_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          email_error: string | null
          email_status: string
          entity_id: string | null
          entity_type: string
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          url?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_key_stage_id: string | null
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          is_owner: boolean
          last_sign_in_at: string | null
          role: Database["public"]["Enums"]["role_enum"]
          status: Database["public"]["Enums"]["profile_status"]
          suspended_at: string | null
          suspended_by: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_key_stage_id?: string | null
          email: string
          full_name?: string | null
          id: string
          invited_by?: string | null
          is_owner?: boolean
          last_sign_in_at?: string | null
          role?: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["profile_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_key_stage_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_owner?: boolean
          last_sign_in_at?: string | null
          role?: Database["public"]["Enums"]["role_enum"]
          status?: Database["public"]["Enums"]["profile_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_key_stage_id_fkey"
            columns: ["default_key_stage_id"]
            isOneToOne: false
            referencedRelation: "key_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_deliverables: {
        Row: {
          added_by: string | null
          asset_id: string | null
          created_at: string
          drive_url: string | null
          id: string
          label: string
          request_id: string
        }
        Insert: {
          added_by?: string | null
          asset_id?: string | null
          created_at?: string
          drive_url?: string | null
          id?: string
          label: string
          request_id: string
        }
        Update: {
          added_by?: string | null
          asset_id?: string | null
          created_at?: string
          drive_url?: string | null
          id?: string
          label?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_deliverables_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_deliverables_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_deliverables_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_watchers: {
        Row: {
          created_at: string
          profile_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_watchers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_watchers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "asset_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      taxonomies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_closed: boolean
          is_hierarchical: boolean
          is_multi: boolean
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_closed?: boolean
          is_hierarchical: boolean
          is_multi: boolean
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_closed?: boolean
          is_hierarchical?: boolean
          is_multi?: boolean
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      taxonomy_asset_types: {
        Row: {
          asset_type_id: string
          taxonomy_id: string
        }
        Insert: {
          asset_type_id: string
          taxonomy_id: string
        }
        Update: {
          asset_type_id?: string
          taxonomy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_asset_types_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_asset_types_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "taxonomies"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_terms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          taxonomy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          taxonomy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          taxonomy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_terms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_terms_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "taxonomies"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          created_at: string
          id: string
          label: string
          number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          number?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      asset_status: "draft" | "published" | "archived"
      collection_visibility: "personal" | "team"
      import_batch_status:
        | "uploaded"
        | "validated"
        | "committing"
        | "committed"
        | "failed"
      import_kind: "assets" | "characters" | "lessons"
      import_row_status:
        | "pending"
        | "valid"
        | "invalid"
        | "duplicate"
        | "skipped"
        | "committed"
        | "failed"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      media_kind: "image" | "video"
      notification_type:
        | "request_status_changed"
        | "request_assigned"
        | "request_comment"
        | "import_completed"
      profile_status: "active" | "suspended"
      request_priority: "low" | "normal" | "high" | "urgent"
      request_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "rejected"
        | "cancelled"
      review_state: "none" | "ready_for_review" | "changes_requested"
      role_enum: "viewer" | "admin" | "super_admin"
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
  app: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_status: ["draft", "published", "archived"],
      collection_visibility: ["personal", "team"],
      import_batch_status: [
        "uploaded",
        "validated",
        "committing",
        "committed",
        "failed",
      ],
      import_kind: ["assets", "characters", "lessons"],
      import_row_status: [
        "pending",
        "valid",
        "invalid",
        "duplicate",
        "skipped",
        "committed",
        "failed",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      media_kind: ["image", "video"],
      notification_type: [
        "request_status_changed",
        "request_assigned",
        "request_comment",
        "import_completed",
      ],
      profile_status: ["active", "suspended"],
      request_priority: ["low", "normal", "high", "urgent"],
      request_status: [
        "submitted",
        "under_review",
        "approved",
        "in_progress",
        "on_hold",
        "completed",
        "rejected",
        "cancelled",
      ],
      review_state: ["none", "ready_for_review", "changes_requested"],
      role_enum: ["viewer", "admin", "super_admin"],
    },
  },
} as const

