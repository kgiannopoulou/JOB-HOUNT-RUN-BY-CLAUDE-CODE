
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "cache_read_tokens": number,"created_at": string,"feature": string,"id": string,"input_tokens": number,"model": string,"output_tokens": number,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number,"created_at"?: string,"feature": string,"id"?: string,"input_tokens"?: number,"model": string,"output_tokens"?: number,"status"?: string,"user_id": string
                  }
                  Update: {
                    "cache_read_tokens"?: number,"created_at"?: string,"feature"?: string,"id"?: string,"input_tokens"?: number,"model"?: string,"output_tokens"?: number,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"application_events": {
                  Row: {
                    "application_id": string,"created_at": string,"from_status": Database["public"]['Enums']["application_status"] | null,"id": string,"kind": string,"to_status": Database["public"]['Enums']["application_status"] | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["application_status"] | null,"id"?: string,"kind": string,"to_status"?: Database["public"]['Enums']["application_status"] | null,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["application_status"] | null,"id"?: string,"kind"?: string,"to_status"?: Database["public"]['Enums']["application_status"] | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_events_application_id_user_id_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"application_interviews": {
                  Row: {
                    "application_id": string,"created_at": string,"id": string,"interviewer": string,"kind": string,"location": string,"notes": string,"scheduled_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"id"?: string,"interviewer"?: string,"kind"?: string,"location"?: string,"notes"?: string,"scheduled_at": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"id"?: string,"interviewer"?: string,"kind"?: string,"location"?: string,"notes"?: string,"scheduled_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_interviews_application_id_user_id_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"application_reminders": {
                  Row: {
                    "application_id": string,"completed_at": string | null,"created_at": string,"due_on": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"completed_at"?: string | null,"created_at"?: string,"due_on": string,"id"?: string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"completed_at"?: string | null,"created_at"?: string,"due_on"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_reminders_application_id_user_id_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"applications": {
                  Row: {
                    "applied_at": string | null,"company": string,"cover_letter_id": string | null,"created_at": string,"id": string,"job_id": string | null,"job_url": string | null,"notes": string,"offer_deadline": string | null,"offer_details": string,"recruiter_email": string,"recruiter_name": string,"recruiter_phone": string,"rejection_reason": string,"resume_id": string | null,"role_title": string,"status": Database["public"]['Enums']["application_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"company": string,"cover_letter_id"?: string | null,"created_at"?: string,"id"?: string,"job_id"?: string | null,"job_url"?: string | null,"notes"?: string,"offer_deadline"?: string | null,"offer_details"?: string,"recruiter_email"?: string,"recruiter_name"?: string,"recruiter_phone"?: string,"rejection_reason"?: string,"resume_id"?: string | null,"role_title": string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "applied_at"?: string | null,"company"?: string,"cover_letter_id"?: string | null,"created_at"?: string,"id"?: string,"job_id"?: string | null,"job_url"?: string | null,"notes"?: string,"offer_deadline"?: string | null,"offer_details"?: string,"recruiter_email"?: string,"recruiter_name"?: string,"recruiter_phone"?: string,"rejection_reason"?: string,"resume_id"?: string | null,"role_title"?: string,"status"?: Database["public"]['Enums']["application_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_cover_letter_id_user_id_fkey"
      columns: ["cover_letter_id","user_id"]
isOneToOne: false
      referencedRelation: "cover_letters"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "applications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_resume_id_user_id_fkey"
      columns: ["resume_id","user_id"]
isOneToOne: false
      referencedRelation: "resumes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"cover_letters": {
                  Row: {
                    "company": string,"content": string,"created_at": string,"generated_content": string,"id": string,"is_edited": boolean,"job_id": string | null,"model": string,"prompt_version": string,"removed_sentences": NonNullable<Json>,"resume_id": string | null,"reviewed_at": string | null,"role_title": string,"tone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company": string,"content"?: string,"created_at"?: string,"generated_content": string,"id"?: string,"is_edited"?: boolean,"job_id"?: string | null,"model": string,"prompt_version": string,"removed_sentences"?: NonNullable<Json>,"resume_id"?: string | null,"reviewed_at"?: string | null,"role_title": string,"tone"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "company"?: string,"content"?: string,"created_at"?: string,"generated_content"?: string,"id"?: string,"is_edited"?: boolean,"job_id"?: string | null,"model"?: string,"prompt_version"?: string,"removed_sentences"?: NonNullable<Json>,"resume_id"?: string | null,"reviewed_at"?: string | null,"role_title"?: string,"tone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cover_letters_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cover_letters_resume_id_user_id_fkey"
      columns: ["resume_id","user_id"]
isOneToOne: false
      referencedRelation: "resumes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"cv_analyses": {
                  Row: {
                    "created_at": string,"id": string,"model": string,"profile_hash": string,"prompt_version": string,"result": NonNullable<Json>,"resume_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"model": string,"profile_hash": string,"prompt_version": string,"result": NonNullable<Json>,"resume_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"model"?: string,"profile_hash"?: string,"prompt_version"?: string,"result"?: NonNullable<Json>,"resume_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cv_analyses_resume_id_user_id_fkey"
      columns: ["resume_id","user_id"]
isOneToOne: false
      referencedRelation: "resumes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"interview_questions": {
                  Row: {
                    "answer": string | null,"category": string | null,"created_at": string,"feedback": Json | null,"id": string,"position": number,"question": string,"session_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: string | null,"category"?: string | null,"created_at"?: string,"feedback"?: Json | null,"id"?: string,"position": number,"question": string,"session_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "answer"?: string | null,"category"?: string | null,"created_at"?: string,"feedback"?: Json | null,"id"?: string,"position"?: number,"question"?: string,"session_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_questions_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "interview_sessions"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"interview_sessions": {
                  Row: {
                    "application_id": string | null,"created_at": string,"id": string,"job_id": string | null,"kind": Database["public"]['Enums']["interview_kind"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"created_at"?: string,"id"?: string,"job_id"?: string | null,"kind"?: Database["public"]['Enums']["interview_kind"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"created_at"?: string,"id"?: string,"job_id"?: string | null,"kind"?: Database["public"]['Enums']["interview_kind"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_sessions_application_id_user_id_fkey"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "interview_sessions_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_matches": {
                  Row: {
                    "created_at": string,"id": string,"job_id": string,"model": string,"prompt_version": string,"result": NonNullable<Json>,"resume_id": string,"score": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_id": string,"model": string,"prompt_version": string,"result"?: NonNullable<Json>,"resume_id": string,"score": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_id"?: string,"model"?: string,"prompt_version"?: string,"result"?: NonNullable<Json>,"resume_id"?: string,"score"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_matches_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_matches_resume_id_user_id_fkey"
      columns: ["resume_id","user_id"]
isOneToOne: false
      referencedRelation: "resumes"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"job_sync_runs": {
                  Row: {
                    "duplicate_count": number,"error": string | null,"fetched_count": number,"finished_at": string | null,"id": string,"inserted_count": number,"provider": string,"skipped_count": number,"started_at": string,"status": string,"updated_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "duplicate_count"?: number,"error"?: string | null,"fetched_count"?: number,"finished_at"?: string | null,"id"?: string,"inserted_count"?: number,"provider": string,"skipped_count"?: number,"started_at"?: string,"status"?: string,"updated_count"?: number
                  }
                  Update: {
                    "duplicate_count"?: number,"error"?: string | null,"fetched_count"?: number,"finished_at"?: string | null,"id"?: string,"inserted_count"?: number,"provider"?: string,"skipped_count"?: number,"started_at"?: string,"status"?: string,"updated_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "category": string | null,"city": string | null,"company": string,"created_at": string,"created_by": string | null,"description": string,"employment_type": Database["public"]['Enums']["employment_type"],"experience_level": Database["public"]['Enums']["experience_level"],"fingerprint": string,"first_seen_at": string,"id": string,"is_active": boolean,"last_seen_at": string,"location_raw": string,"locations": (string)[],"posted_at": string | null,"provider": string,"provider_job_id": string,"remote_policy": Database["public"]['Enums']["remote_policy"],"salary_annual_max": number | null,"salary_annual_min": number | null,"salary_currency": string | null,"salary_max": number | null,"salary_min": number | null,"salary_text": string | null,"search_vector": unknown,"source_url": string,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"city"?: string | null,"company": string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: Database["public"]['Enums']["employment_type"],"experience_level"?: Database["public"]['Enums']["experience_level"],"fingerprint": string,"first_seen_at"?: string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string,"location_raw"?: string,"locations"?: (string)[],"posted_at"?: string | null,"provider": string,"provider_job_id": string,"remote_policy"?: Database["public"]['Enums']["remote_policy"],"salary_annual_max"?: number | null,"salary_annual_min"?: number | null,"salary_currency"?: string | null,"salary_max"?: number | null,"salary_min"?: number | null,"salary_text"?: string | null,"search_vector"?: never,"source_url": string,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string | null,"city"?: string | null,"company"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"employment_type"?: Database["public"]['Enums']["employment_type"],"experience_level"?: Database["public"]['Enums']["experience_level"],"fingerprint"?: string,"first_seen_at"?: string,"id"?: string,"is_active"?: boolean,"last_seen_at"?: string,"location_raw"?: string,"locations"?: (string)[],"posted_at"?: string | null,"provider"?: string,"provider_job_id"?: string,"remote_policy"?: Database["public"]['Enums']["remote_policy"],"salary_annual_max"?: number | null,"salary_annual_min"?: number | null,"salary_currency"?: string | null,"salary_max"?: number | null,"salary_min"?: number | null,"salary_text"?: string | null,"search_vector"?: never,"source_url"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"link": string | null,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"headline": string,"id": string,"linkedin_url": string,"location": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"headline"?: string,"id": string,"linkedin_url"?: string,"location"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"headline"?: string,"id"?: string,"linkedin_url"?: string,"location"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"resumes": {
                  Row: {
                    "content": Json | null,"created_at": string,"extracted_text": string | null,"file_name": string | null,"file_size": number | null,"file_type": string | null,"id": string,"is_primary": boolean,"kind": string,"layout": Json | null,"parent_resume_id": string | null,"parse_error": string | null,"parse_status": Database["public"]['Enums']["resume_parse_status"],"storage_path": string | null,"tailoring": Json | null,"target_job_id": string | null,"template": string,"title": string,"updated_at": string,"user_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: Json | null,"created_at"?: string,"extracted_text"?: string | null,"file_name"?: string | null,"file_size"?: number | null,"file_type"?: string | null,"id"?: string,"is_primary"?: boolean,"kind"?: string,"layout"?: Json | null,"parent_resume_id"?: string | null,"parse_error"?: string | null,"parse_status"?: Database["public"]['Enums']["resume_parse_status"],"storage_path"?: string | null,"tailoring"?: Json | null,"target_job_id"?: string | null,"template"?: string,"title": string,"updated_at"?: string,"user_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "content"?: Json | null,"created_at"?: string,"extracted_text"?: string | null,"file_name"?: string | null,"file_size"?: number | null,"file_type"?: string | null,"id"?: string,"is_primary"?: boolean,"kind"?: string,"layout"?: Json | null,"parent_resume_id"?: string | null,"parse_error"?: string | null,"parse_status"?: Database["public"]['Enums']["resume_parse_status"],"storage_path"?: string | null,"tailoring"?: Json | null,"target_job_id"?: string | null,"template"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "resumes_parent_resume_id_user_id_fkey"
      columns: ["parent_resume_id","user_id"]
isOneToOne: false
      referencedRelation: "resumes"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "resumes_target_job_id_fkey"
      columns: ["target_job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_jobs": {
                  Row: {
                    "created_at": string,"job_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"job_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"job_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_jobs_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "created_at": string,"desired_locations": (string)[],"desired_titles": (string)[],"email_notifications": boolean,"employment_types": (Database["public"]['Enums']["employment_type"])[],"experience_level": Database["public"]['Enums']["experience_level"],"min_salary": number | null,"remote_policies": (Database["public"]['Enums']["remote_policy"])[],"salary_currency": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"desired_locations"?: (string)[],"desired_titles"?: (string)[],"email_notifications"?: boolean,"employment_types"?: (Database["public"]['Enums']["employment_type"])[],"experience_level"?: Database["public"]['Enums']["experience_level"],"min_salary"?: number | null,"remote_policies"?: (Database["public"]['Enums']["remote_policy"])[],"salary_currency"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"desired_locations"?: (string)[],"desired_titles"?: (string)[],"email_notifications"?: boolean,"employment_types"?: (Database["public"]['Enums']["employment_type"])[],"experience_level"?: Database["public"]['Enums']["experience_level"],"min_salary"?: number | null,"remote_policies"?: (Database["public"]['Enums']["remote_policy"])[],"salary_currency"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "application_move_allowed":
{ Args: { "p_from": Database["public"]['Enums']["application_status"],"p_to": Database["public"]['Enums']["application_status"] }; Returns: boolean
                           },
"job_location_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "job_count": number,"location": string
            }[]
                           },
"reserve_ai_call":
{ Args: { "p_daily_limit": number,"p_feature": string,"p_model": string,"p_user_id": string }; Returns: string
                           },
"search_jobs":
{ Args: { "p_city"?: string,"p_company"?: string,"p_employment_types"?: (Database["public"]['Enums']["employment_type"])[],"p_experience_levels"?: (Database["public"]['Enums']["experience_level"])[],"p_keywords"?: string,"p_limit"?: number,"p_locations"?: (string)[],"p_min_salary"?: number,"p_offset"?: number,"p_remote_policies"?: (Database["public"]['Enums']["remote_policy"])[],"p_sort"?: string,"p_title"?: string }; Returns: {
              "category": string,"company": string,"description": string,"employment_type": Database["public"]['Enums']["employment_type"],"experience_level": Database["public"]['Enums']["experience_level"],"id": string,"location_raw": string,"posted_at": string,"provider": string,"remote_policy": Database["public"]['Enums']["remote_policy"],"salary_text": string,"source_url": string,"tags": (string)[],"title": string,"total_count": number
            }[]
                           }
          }
          Enums: {
            "application_status": "saved"|"applied"|"assessment"|"interview"|"offer"|"rejected","employment_type": "full_time"|"part_time"|"contract"|"freelance"|"internship"|"unknown","experience_level": "intern"|"entry"|"mid"|"senior"|"lead"|"unknown","interview_kind": "behavioural"|"technical"|"mixed","remote_policy": "remote"|"hybrid"|"onsite"|"unknown","resume_parse_status": "pending"|"parsing"|"needs_review"|"ready"|"failed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "application_status": ["saved", "applied", "assessment", "interview", "offer", "rejected"],"employment_type": ["full_time", "part_time", "contract", "freelance", "internship", "unknown"],"experience_level": ["intern", "entry", "mid", "senior", "lead", "unknown"],"interview_kind": ["behavioural", "technical", "mixed"],"remote_policy": ["remote", "hybrid", "onsite", "unknown"],"resume_parse_status": ["pending", "parsing", "needs_review", "ready", "failed"]
          }
        }
} as const
