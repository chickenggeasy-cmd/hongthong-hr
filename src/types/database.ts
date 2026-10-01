export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          created_at: string
          distance_meters: number
          employee_id: string
          id: string
          latitude: number
          longitude: number
          photo_path: string | null
          recorded_at: string
          type: string
          within_radius: boolean
        }
        Insert: {
          created_at?: string
          distance_meters: number
          employee_id: string
          id?: string
          latitude: number
          longitude: number
          photo_path?: string | null
          recorded_at?: string
          type: string
          within_radius: boolean
        }
        Update: {
          created_at?: string
          distance_meters?: number
          employee_id?: string
          id?: string
          latitude?: number
          longitude?: number
          photo_path?: string | null
          recorded_at?: string
          type?: string
          within_radius?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          role: string
          team_group: string | null
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          role: string
          team_group?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          role?: string
          team_group?: string | null
        }
        Relationships: []
      }
      employee_code_counters: {
        Row: {
          block_start_year: number
          dept_code: string
          last_number: number
        }
        Insert: {
          block_start_year: number
          dept_code: string
          last_number?: number
        }
        Update: {
          block_start_year?: number
          dept_code?: string
          last_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_code_counters_dept_code_fkey"
            columns: ["dept_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
        ]
      }
      employee_credentials: {
        Row: {
          employee_id: string
          national_id_hash: string
        }
        Insert: {
          employee_id: string
          national_id_hash: string
        }
        Update: {
          employee_id?: string
          national_id_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_credentials_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          created_at: string
          dept_code: string
          employee_code: string
          full_name: string
          id: string
          photo_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          dept_code: string
          employee_code: string
          full_name: string
          id?: string
          photo_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          dept_code?: string
          employee_code?: string
          full_name?: string
          id?: string
          photo_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_dept_code_fkey"
            columns: ["dept_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          holiday_date: string
          name: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          name: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          name?: string
        }
        Relationships: [
        ]
      }
      leave_requests: {
        Row: {
          approver_id: string | null
          created_at: string
          days_count: number
          decided_at: string | null
          decision_note: string | null
          employee_id: string
          end_date: string
          exceeds_quota: boolean
          id: string
          leave_type: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          days_count: number
          decided_at?: string | null
          decision_note?: string | null
          employee_id: string
          end_date: string
          exceeds_quota?: boolean
          id?: string
          leave_type: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          days_count?: number
          decided_at?: string | null
          decision_note?: string | null
          employee_id?: string
          end_date?: string
          exceeds_quota?: boolean
          id?: string
          leave_type?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_requests: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          employee_id: string
          hours: number
          id: string
          reason: string | null
          status: string
          updated_at: string
          work_date: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          employee_id: string
          hours: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          employee_id?: string
          hours?: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_end: string
          cycle_start: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          period: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_end: string
          cycle_start: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          period: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_end?: string
          cycle_start?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          period?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          absent_days: number
          base_pay: number
          created_at: string
          daily_rate: number
          dept_name: string
          details: Json
          employee_code: string
          employee_id: string
          full_name: string
          id: string
          late_days: number
          late_deduction: number
          late_minutes: number
          leave_days: number
          leave_penalty: number
          net_pay: number
          ot_hours: number
          ot_pay: number
          over_quota_days: number
          paid_holiday_days: number
          run_id: string
          social_security: number
          worked_days: number
          working_days: number
        }
        Insert: {
          absent_days?: number
          base_pay?: number
          created_at?: string
          daily_rate: number
          dept_name: string
          details?: Json
          employee_code: string
          employee_id: string
          full_name: string
          id?: string
          late_days?: number
          late_deduction?: number
          late_minutes?: number
          leave_days?: number
          leave_penalty?: number
          net_pay?: number
          ot_hours?: number
          ot_pay?: number
          over_quota_days?: number
          paid_holiday_days?: number
          run_id: string
          social_security?: number
          worked_days?: number
          working_days?: number
        }
        Update: {
          absent_days?: number
          base_pay?: number
          created_at?: string
          daily_rate?: number
          dept_name?: string
          details?: Json
          employee_code?: string
          employee_id?: string
          full_name?: string
          id?: string
          late_days?: number
          late_deduction?: number
          late_minutes?: number
          leave_days?: number
          leave_penalty?: number
          net_pay?: number
          ot_hours?: number
          ot_pay?: number
          over_quota_days?: number
          paid_holiday_days?: number
          run_id?: string
          social_security?: number
          worked_days?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      warnings: {
        Row: {
          acknowledged_at: string | null
          employee_id: string
          id: string
          issued_at: string
          issued_by: string | null
          kind: string
          period: string | null
          reason: string
        }
        Insert: {
          acknowledged_at?: string | null
          employee_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          kind: string
          period?: string | null
          reason: string
        }
        Update: {
          acknowledged_at?: string | null
          employee_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          kind?: string
          period?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_warning: { Args: { p_warning_id: string }; Returns: undefined }
      approval_block_reason: { Args: { p_requester_id: string }; Returns: string }
      auth_dept_code: { Args: never; Returns: string }
      auth_employee_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      decide_leave_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: undefined
      }
      decide_ot_request: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: undefined
      }
      distance_meters: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      finalize_payroll_run: {
        Args: { p_finalized_by: string; p_run_id: string }
        Returns: undefined
      }
      generate_employee_code: {
        Args: { p_be_year?: number; p_dept_code: string }
        Returns: string
      }
      leave_settings: {
        Args: never
        Returns: {
          advance_notice_months: number
          monthly_quota_days: number
          sick_backdate_days: number
        }[]
      }
      leave_working_days: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      public_settings: {
        Args: never
        Returns: {
          key: string
          value: string
        }[]
      }
      register_employee: {
        Args: {
          p_dept_code: string
          p_full_name: string
          p_national_id_hash: string
          p_photo_path?: string
        }
        Returns: {
          new_employee_code: string
          new_id: string
        }[]
      }
      request_leave: {
        Args: {
          p_end_date: string
          p_leave_type: string
          p_reason?: string
          p_start_date: string
        }
        Returns: {
          new_request_id: string
          over_quota: boolean
          total_days: number
        }[]
      }
      request_ot: {
        Args: { p_hours: number; p_reason?: string; p_work_date: string }
        Returns: string
      }
      save_payroll_run: {
        Args: {
          p_created_by: string
          p_cycle_end: string
          p_cycle_start: string
          p_payslips: Json
          p_period: string
        }
        Returns: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
