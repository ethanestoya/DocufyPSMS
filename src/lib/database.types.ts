export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: Database['public']['Enums']['app_role']
          email: string | null
          phone: string | null
          address: string | null
          student_id: string | null
          employee_id: string | null
          profile_image_path: string | null
          active: boolean
          suspended: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          role?: Database['public']['Enums']['app_role']
          email?: string | null
          phone?: string | null
          address?: string | null
          student_id?: string | null
          employee_id?: string | null
          profile_image_path?: string | null
          active?: boolean
          suspended?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: Database['public']['Enums']['app_role']
          email?: string | null
          phone?: string | null
          address?: string | null
          student_id?: string | null
          employee_id?: string | null
          profile_image_path?: string | null
          active?: boolean
          suspended?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      staff_records: {
        Row: {
          id: string
          profile_id: string | null
          employee_code: string | null
          full_name: string
          email: string
          phone: string | null
          role: Database['public']['Enums']['app_role']
          status: string
          attendance_status: string
          on_leave_reason: string | null
          join_date: string
          skills_message: string | null
          portfolio_link: string | null
          permissions: string[]
          salary: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          employee_code?: string | null
          full_name: string
          email: string
          phone?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: string
          attendance_status?: string
          on_leave_reason?: string | null
          join_date?: string
          skills_message?: string | null
          portfolio_link?: string | null
          permissions?: string[]
          salary?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          employee_code?: string | null
          full_name?: string
          email?: string
          phone?: string | null
          role?: Database['public']['Enums']['app_role']
          status?: string
          attendance_status?: string
          on_leave_reason?: string | null
          join_date?: string
          skills_message?: string | null
          portfolio_link?: string | null
          permissions?: string[]
          salary?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'staff_records_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      staff_performance_notes: {
        Row: {
          id: string
          staff_id: string
          note_date: string
          note: string
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          note_date?: string
          note: string
          rating?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          note_date?: string
          note?: string
          rating?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'staff_performance_notes_staff_id_fkey'
            columns: ['staff_id']
            referencedRelation: 'staff_records'
            referencedColumns: ['id']
          }
        ]
      }
      staff_allowances: {
        Row: {
          id: string
          staff_id: string
          allowance_type: string
          amount: number
        }
        Insert: {
          id?: string
          staff_id: string
          allowance_type: string
          amount?: number
        }
        Update: {
          id?: string
          staff_id?: string
          allowance_type?: string
          amount?: number
        }
        Relationships: [
          {
            foreignKeyName: 'staff_allowances_staff_id_fkey'
            columns: ['staff_id']
            referencedRelation: 'staff_records'
            referencedColumns: ['id']
          }
        ]
      }
      staff_tasks: {
        Row: {
          id: string
          staff_id: string
          title: string
          status: string
          priority: string
          due_date: string | null
        }
        Insert: {
          id?: string
          staff_id: string
          title: string
          status?: string
          priority?: string
          due_date?: string | null
        }
        Update: {
          id?: string
          staff_id?: string
          title?: string
          status?: string
          priority?: string
          due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'staff_tasks_staff_id_fkey'
            columns: ['staff_id']
            referencedRelation: 'staff_records'
            referencedColumns: ['id']
          }
        ]
      }
      salary_settings: {
        Row: {
          id: boolean
          hourly_rate: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          hourly_rate?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          hourly_rate?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'salary_settings_updated_by_fkey'
            columns: ['updated_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      salary_releases: {
        Row: {
          id: string
          staff_id: string
          period_start: string
          period_end: string
          total_hours: number
          hourly_rate: number
          released_amount: number
          released_by: string | null
          released_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          period_start: string
          period_end: string
          total_hours?: number
          hourly_rate: number
          released_amount: number
          released_by?: string | null
          released_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          period_start?: string
          period_end?: string
          total_hours?: number
          hourly_rate?: number
          released_amount?: number
          released_by?: string | null
          released_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'salary_releases_staff_id_fkey'
            columns: ['staff_id']
            referencedRelation: 'staff_records'
            referencedColumns: ['id']
          }
        ]
      }
      attendance_records: {
        Row: {
          id: string
          profile_id: string | null
          staff_id: string | null
          attendance_date: string
          time_in: string | null
          time_out: string | null
          exceeded: boolean
          extra_sessions: Json
          absence_status: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          staff_id?: string | null
          attendance_date: string
          time_in?: string | null
          time_out?: string | null
          exceeded?: boolean
          extra_sessions?: Json
          absence_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          staff_id?: string | null
          attendance_date?: string
          time_in?: string | null
          time_out?: string | null
          exceeded?: boolean
          extra_sessions?: Json
          absence_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_records_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      attendance_adjustments: {
        Row: {
          id: string
          attendance_id: string
          field_name: string
          old_value: string | null
          new_value: string | null
          reason: string | null
          adjusted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          attendance_id: string
          field_name: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          adjusted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          attendance_id?: string
          field_name?: string
          old_value?: string | null
          new_value?: string | null
          reason?: string | null
          adjusted_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_adjustments_attendance_id_fkey'
            columns: ['attendance_id']
            referencedRelation: 'attendance_records'
            referencedColumns: ['id']
          }
        ]
      }
      orders: {
        Row: {
          id: string
          order_number: number
          customer_id: string | null
          customer_name: string
          customer_email: string
          status: Database['public']['Enums']['order_status']
          order_source: Database['public']['Enums']['order_source']
          customer_type: string | null
          subtotal: number
          addons_total: number
          total: number
          manual_total: number | null
          hold_reason: string | null
          cancellation_reason: string | null
          payment_deadline: string | null
          down_payment_required: boolean
          down_payment_amount: number | null
          down_payment_verified: boolean
          full_payment_required: boolean
          full_payment_amount: number | null
          full_payment_verified: boolean
          payment_amount_paid: number
          expected_paper_usage: Json
          paper_deducted_on_create: boolean
          paper_confirmed: boolean
          error_usage: Json | null
          notes: string | null
          created_at: string
          updated_at: string
          status_updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          customer_name: string
          customer_email: string
          status?: Database['public']['Enums']['order_status']
          order_source?: Database['public']['Enums']['order_source']
          customer_type?: string | null
          subtotal?: number
          addons_total?: number
          total?: number
          manual_total?: number | null
          hold_reason?: string | null
          cancellation_reason?: string | null
          payment_deadline?: string | null
          down_payment_required?: boolean
          down_payment_amount?: number | null
          down_payment_verified?: boolean
          full_payment_required?: boolean
          full_payment_amount?: number | null
          full_payment_verified?: boolean
          payment_amount_paid?: number
          expected_paper_usage?: Json
          paper_deducted_on_create?: boolean
          paper_confirmed?: boolean
          error_usage?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          status_updated_at?: string
          order_number?: never
        }
        Update: {
          id?: string
          customer_id?: string | null
          customer_name?: string
          customer_email?: string
          status?: Database['public']['Enums']['order_status']
          order_source?: Database['public']['Enums']['order_source']
          customer_type?: string | null
          subtotal?: number
          addons_total?: number
          total?: number
          manual_total?: number | null
          hold_reason?: string | null
          cancellation_reason?: string | null
          payment_deadline?: string | null
          down_payment_required?: boolean
          down_payment_amount?: number | null
          down_payment_verified?: boolean
          full_payment_required?: boolean
          full_payment_amount?: number | null
          full_payment_verified?: boolean
          payment_amount_paid?: number
          expected_paper_usage?: Json
          paper_deducted_on_create?: boolean
          paper_confirmed?: boolean
          error_usage?: Json | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          status_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      order_files: {
        Row: {
          id: string
          order_id: string
          storage_path: string | null
          original_name: string
          mime_type: string | null
          size_bytes: number | null
          page_count: number | null
          print_type: string | null
          content_type: string | null
          paper_size: string | null
          copies: number
          color_mode: string | null
          page_range: string | null
          specific_pages: string | null
          pages_per_sheet: string | null
          orientation: string | null
          two_sided: string | null
          margins: string | null
          scale: string | null
          custom_scale: number | null
          photo_size: string | null
          photo_quantity: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          storage_path?: string | null
          original_name: string
          mime_type?: string | null
          size_bytes?: number | null
          page_count?: number | null
          print_type?: string | null
          content_type?: string | null
          paper_size?: string | null
          copies?: number
          color_mode?: string | null
          page_range?: string | null
          specific_pages?: string | null
          pages_per_sheet?: string | null
          orientation?: string | null
          two_sided?: string | null
          margins?: string | null
          scale?: string | null
          custom_scale?: number | null
          photo_size?: string | null
          photo_quantity?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          storage_path?: string | null
          original_name?: string
          mime_type?: string | null
          size_bytes?: number | null
          page_count?: number | null
          print_type?: string | null
          content_type?: string | null
          paper_size?: string | null
          copies?: number
          color_mode?: string | null
          page_range?: string | null
          specific_pages?: string | null
          pages_per_sheet?: string | null
          orientation?: string | null
          two_sided?: string | null
          margins?: string | null
          scale?: string | null
          custom_scale?: number | null
          photo_size?: string | null
          photo_quantity?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_files_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      order_addons: {
        Row: {
          id: string
          order_id: string
          name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          order_id?: string
          name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_addons_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      order_cost_breakdowns: {
        Row: {
          order_id: string
          printing_cost: number
          addons_cost: number
          total: number
        }
        Insert: {
          order_id: string
          printing_cost?: number
          addons_cost?: number
          total?: number
        }
        Update: {
          order_id?: string
          printing_cost?: number
          addons_cost?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_cost_breakdowns_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          old_status: Database['public']['Enums']['order_status'] | null
          new_status: Database['public']['Enums']['order_status']
          reason: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          old_status?: Database['public']['Enums']['order_status'] | null
          new_status: Database['public']['Enums']['order_status']
          reason?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          old_status?: Database['public']['Enums']['order_status'] | null
          new_status?: Database['public']['Enums']['order_status']
          reason?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_status_history_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      payment_methods: {
        Row: {
          id: string
          name: string
          account_name: string
          account_number: string
          qr_storage_path: string | null
          active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          account_name: string
          account_number: string
          qr_storage_path?: string | null
          active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          account_name?: string
          account_number?: string
          qr_storage_path?: string | null
          active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payment_methods_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          order_id: string
          method_id: string | null
          method_name: string
          amount: number
          reference_number: string | null
          proof_storage_path: string | null
          status: Database['public']['Enums']['payment_status']
          rejection_reason: string | null
          submitted_by: string | null
          verified_by: string | null
          submitted_at: string
          verified_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          method_id?: string | null
          method_name: string
          amount: number
          reference_number?: string | null
          proof_storage_path?: string | null
          status?: Database['public']['Enums']['payment_status']
          rejection_reason?: string | null
          submitted_by?: string | null
          verified_by?: string | null
          submitted_at?: string
          verified_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          method_id?: string | null
          method_name?: string
          amount?: number
          reference_number?: string | null
          proof_storage_path?: string | null
          status?: Database['public']['Enums']['payment_status']
          rejection_reason?: string | null
          submitted_by?: string | null
          verified_by?: string | null
          submitted_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_method_id_fkey'
            columns: ['method_id']
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          category: string
          brand: string | null
          unit: string
          current_stock: number
          minimum_stock: number
          price: number | null
          paper_size: string | null
          pieces_per_unit: number
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          brand?: string | null
          unit: string
          current_stock?: number
          minimum_stock?: number
          price?: number | null
          paper_size?: string | null
          pieces_per_unit?: number
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          brand?: string | null
          unit?: string
          current_stock?: number
          minimum_stock?: number
          price?: number | null
          paper_size?: string | null
          pieces_per_unit?: number
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          id: string
          item_id: string
          movement_type: string
          quantity: number
          unit: string
          reason: string | null
          person: string | null
          related_order_id: string | null
          related_transaction_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          movement_type: string
          quantity: number
          unit: string
          reason?: string | null
          person?: string | null
          related_order_id?: string | null
          related_transaction_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          movement_type?: string
          quantity?: number
          unit?: string
          reason?: string | null
          person?: string | null
          related_order_id?: string | null
          related_transaction_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_item_id_fkey'
            columns: ['item_id']
            referencedRelation: 'inventory_items'
            referencedColumns: ['id']
          }
        ]
      }
      walk_in_transactions: {
        Row: {
          id: string
          transaction_number: number
          order_id: string | null
          customer_name: string | null
          customer_type: string
          total: number
          payment_method: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          customer_name?: string | null
          customer_type?: string
          total?: number
          payment_method?: string
          created_by?: string | null
          created_at?: string
          transaction_number?: never
        }
        Update: {
          id?: string
          order_id?: string | null
          customer_name?: string | null
          customer_type?: string
          total?: number
          payment_method?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'walk_in_transactions_order_id_fkey'
            columns: ['order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      jobs: {
        Row: {
          id: string
          title: string
          description: string
          job_type: string
          duration: string | null
          department: string | null
          location: string | null
          salary: string | null
          schedule: string | null
          requirements: string[]
          responsibilities: string[]
          status: Database['public']['Enums']['job_status']
          posted_date: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          job_type: string
          duration?: string | null
          department?: string | null
          location?: string | null
          salary?: string | null
          schedule?: string | null
          requirements?: string[]
          responsibilities?: string[]
          status?: Database['public']['Enums']['job_status']
          posted_date?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          job_type?: string
          duration?: string | null
          department?: string | null
          location?: string | null
          salary?: string | null
          schedule?: string | null
          requirements?: string[]
          responsibilities?: string[]
          status?: Database['public']['Enums']['job_status']
          posted_date?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          id: string
          job_id: string
          applicant_profile_id: string | null
          first_name: string
          last_name: string
          full_name: string
          email: string
          contact: string
          address: string | null
          position: string
          skills: string | null
          cover_letter: string | null
          portfolio_url: string | null
          portfolio_storage_path: string | null
          status: Database['public']['Enums']['application_status']
          interview_date: string | null
          interview_time: string | null
          interview_location: string | null
          rejection_reason: string | null
          applied_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          applicant_profile_id?: string | null
          first_name: string
          last_name: string
          full_name: string
          email: string
          contact: string
          address?: string | null
          position: string
          skills?: string | null
          cover_letter?: string | null
          portfolio_url?: string | null
          portfolio_storage_path?: string | null
          status?: Database['public']['Enums']['application_status']
          interview_date?: string | null
          interview_time?: string | null
          interview_location?: string | null
          rejection_reason?: string | null
          applied_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          applicant_profile_id?: string | null
          first_name?: string
          last_name?: string
          full_name?: string
          email?: string
          contact?: string
          address?: string | null
          position?: string
          skills?: string | null
          cover_letter?: string | null
          portfolio_url?: string | null
          portfolio_storage_path?: string | null
          status?: Database['public']['Enums']['application_status']
          interview_date?: string | null
          interview_time?: string | null
          interview_location?: string | null
          rejection_reason?: string | null
          applied_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'job_applications_job_id_fkey'
            columns: ['job_id']
            referencedRelation: 'jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_applications_applicant_profile_id_fkey'
            columns: ['applicant_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      announcements: {
        Row: {
          id: string
          title: string
          message: string
          announcement_type: string
          priority: Database['public']['Enums']['announcement_priority']
          recipient_role: Database['public']['Enums']['app_role'] | null
          recipient_email: string | null
          sent_by: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          title: string
          message: string
          announcement_type?: string
          priority?: Database['public']['Enums']['announcement_priority']
          recipient_role?: Database['public']['Enums']['app_role'] | null
          recipient_email?: string | null
          sent_by?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          title?: string
          message?: string
          announcement_type?: string
          priority?: Database['public']['Enums']['announcement_priority']
          recipient_role?: Database['public']['Enums']['app_role'] | null
          recipient_email?: string | null
          sent_by?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'announcement_reads_announcement_id_fkey'
            columns: ['announcement_id']
            referencedRelation: 'announcements'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'announcement_reads_profile_id_fkey'
            columns: ['profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          notification_type: string
          priority: string | null
          title: string
          message: string
          recipient_profile_id: string | null
          recipient_role: Database['public']['Enums']['app_role'] | null
          related_order_id: string | null
          related_route: string | null
          clickable: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          priority?: string | null
          title: string
          message: string
          recipient_profile_id?: string | null
          recipient_role?: Database['public']['Enums']['app_role'] | null
          related_order_id?: string | null
          related_route?: string | null
          clickable?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          priority?: string | null
          title?: string
          message?: string
          recipient_profile_id?: string | null
          recipient_role?: Database['public']['Enums']['app_role'] | null
          related_order_id?: string | null
          related_route?: string | null
          clickable?: boolean
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_profile_id_fkey'
            columns: ['recipient_profile_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_related_order_id_fkey'
            columns: ['related_order_id']
            referencedRelation: 'orders'
            referencedColumns: ['id']
          }
        ]
      }
      pricing_settings: {
        Row: {
          id: boolean
          bw: number
          color_low: number
          color_high: number
          size_long_legal_folio: number
          size_a3: number
          duplex_savings: number
          down_payment_threshold: number
          full_payment_threshold: number
          cash_payment_window_seconds: number
          online_payment_window_seconds: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          bw?: number
          color_low?: number
          color_high?: number
          size_long_legal_folio?: number
          size_a3?: number
          duplex_savings?: number
          down_payment_threshold?: number
          full_payment_threshold?: number
          cash_payment_window_seconds?: number
          online_payment_window_seconds?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          bw?: number
          color_low?: number
          color_high?: number
          size_long_legal_folio?: number
          size_a3?: number
          duplex_savings?: number
          down_payment_threshold?: number
          full_payment_threshold?: number
          cash_payment_window_seconds?: number
          online_payment_window_seconds?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_matrix_cells: {
        Row: {
          id: string
          service_type: string
          content_type: string | null
          color_tier: string | null
          paper_size: string | null
          photo_size: string | null
          price: number | null
          minimum_quantity: number | null
        }
        Insert: {
          id?: string
          service_type: string
          content_type?: string | null
          color_tier?: string | null
          paper_size?: string | null
          photo_size?: string | null
          price?: number | null
          minimum_quantity?: number | null
        }
        Update: {
          id?: string
          service_type?: string
          content_type?: string | null
          color_tier?: string | null
          paper_size?: string | null
          photo_size?: string | null
          price?: number | null
          minimum_quantity?: number | null
        }
        Relationships: []
      }
      shop_status: {
        Row: {
          id: boolean
          status: string
          reason: string | null
          eta: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          status?: string
          reason?: string | null
          eta?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          status?: string
          reason?: string | null
          eta?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      landing_content: {
        Row: {
          id: boolean
          content: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          content?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          content?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      legal_policies: {
        Row: {
          id: string
          policy_type: string
          title: string
          content: string
          version: string
          published: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          policy_type: string
          title: string
          content: string
          version?: string
          published?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          policy_type?: string
          title?: string
          content?: string
          version?: string
          published?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          id: boolean
          logo_storage_path: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          logo_storage_path?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          logo_storage_path?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_photos: {
        Row: {
          id: string
          storage_path: string | null
          caption: string | null
          display_order: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          storage_path: string
          caption?: string | null
          display_order?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          storage_path?: string | null
          caption?: string | null
          display_order?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      order_locks: {
        Row: {
          order_id: string
          locked_by: string
          locked_at: string
          expires_at: string
        }
        Insert: {
          order_id: string
          locked_by: string
          locked_at?: string
          expires_at: string
        }
        Update: {
          order_id?: string
          locked_by?: string
          locked_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_locks_locked_by_fkey'
            columns: ['locked_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['app_role']
      }
      has_role: {
        Args: { required_role: Database['public']['Enums']['app_role'] }
        Returns: boolean
      }
    }
    Enums: {
      announcement_priority: 'regular' | 'important' | 'emergency'
      app_role: 'customer' | 'staff' | 'admin'
      application_status: 'Pending' | 'Under Review' | 'For Interview' | 'Approved' | 'Rejected'
      job_status: 'active' | 'closed' | 'archived'
      order_source: 'online' | 'walkin'
      order_status:
        | 'Awaiting Payment'
        | 'In Queue'
        | 'Printing'
        | 'Completed'
        | 'Released'
        | 'Canceled'
      payment_status: 'pending' | 'verified' | 'rejected' | 'expired' | 'canceled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
