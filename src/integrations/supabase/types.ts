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
      detalles_inspeccion: {
        Row: {
          created_at: string
          foto_evidencia_url: string | null
          ia_comentario: string | null
          ia_sugerido_puntaje: number | null
          id: string
          inspeccion_id: string
          observaciones: string | null
          promedio: number | null
          s1_puntaje: number | null
          s2_puntaje: number | null
          s3_puntaje: number | null
          s4_puntaje: number | null
          s5_puntaje: number | null
          sub_item_id: string
          sub_item_nombre: string
        }
        Insert: {
          created_at?: string
          foto_evidencia_url?: string | null
          ia_comentario?: string | null
          ia_sugerido_puntaje?: number | null
          id?: string
          inspeccion_id: string
          observaciones?: string | null
          promedio?: number | null
          s1_puntaje?: number | null
          s2_puntaje?: number | null
          s3_puntaje?: number | null
          s4_puntaje?: number | null
          s5_puntaje?: number | null
          sub_item_id: string
          sub_item_nombre: string
        }
        Update: {
          created_at?: string
          foto_evidencia_url?: string | null
          ia_comentario?: string | null
          ia_sugerido_puntaje?: number | null
          id?: string
          inspeccion_id?: string
          observaciones?: string | null
          promedio?: number | null
          s1_puntaje?: number | null
          s2_puntaje?: number | null
          s3_puntaje?: number | null
          s4_puntaje?: number | null
          s5_puntaje?: number | null
          sub_item_id?: string
          sub_item_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalles_inspeccion_inspeccion_id_fkey"
            columns: ["inspeccion_id"]
            isOneToOne: false
            referencedRelation: "inspecciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalles_inspeccion_sub_item_id_fkey"
            columns: ["sub_item_id"]
            isOneToOne: false
            referencedRelation: "sub_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inspecciones: {
        Row: {
          anio: number
          created_at: string
          estado: Database["public"]["Enums"]["inspeccion_estado"]
          finalizada_at: string | null
          id: string
          mes: number
          puntaje_total: number | null
          responsable: string
          sector_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anio: number
          created_at?: string
          estado?: Database["public"]["Enums"]["inspeccion_estado"]
          finalizada_at?: string | null
          id?: string
          mes: number
          puntaje_total?: number | null
          responsable: string
          sector_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anio?: number
          created_at?: string
          estado?: Database["public"]["Enums"]["inspeccion_estado"]
          finalizada_at?: string | null
          id?: string
          mes?: number
          puntaje_total?: number | null
          responsable?: string
          sector_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecciones_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id: string
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      sectores: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      sub_items: {
        Row: {
          created_at: string
          foto_maestra_url: string | null
          id: string
          nombre: string
          orden: number
          sector_id: string
        }
        Insert: {
          created_at?: string
          foto_maestra_url?: string | null
          id?: string
          nombre: string
          orden?: number
          sector_id: string
        }
        Update: {
          created_at?: string
          foto_maestra_url?: string | null
          id?: string
          nombre?: string
          orden?: number
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_items_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      inspeccion_estado: "borrador" | "finalizada"
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
  public: {
    Enums: {
      inspeccion_estado: ["borrador", "finalizada"],
    },
  },
} as const
