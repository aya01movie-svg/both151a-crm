/**
 * アプリ内で使うドメイン型定義。
 * supabase/001〜003 のスキーマに対応する。
 * （将来的に `supabase gen types typescript` で自動生成へ置き換え可能）
 */

export type StaffRole = "staff" | "admin";
export type CustomerRank = "first" | "regular" | "vip" | "special";
export type PaymentMethod = "cash" | "credit" | "other";
export type SeatType = "counter" | "box";
export type BottleStatus = "kept" | "finished" | "returned" | "disposed";
export type ReservationStatus = "reserved" | "visited" | "cancelled";

export type Profile = {
  id: string;
  display_name: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  display_name: string;
  kana: string | null;
  real_name: string | null;
  birthday: string | null; // date (YYYY-MM-DD)
  memo: string | null;
  rank: CustomerRank;
  favorite: boolean;
  hidden: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // 002で追加した集計カラム（保存して自動更新方式）
  visit_count: number;
  total_amount: number;
  total_tip: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  current_bottle_count: number;
  caution_level: CautionLevel;
  caution_reason: string | null;
  caution_registered_at: string | null;
  caution_registered_by: string | null;
};

/** customer_month_stats ビュー（今月来店回数・今月売上・今月チップ） */
export type CustomerMonthStats = {
  customer_id: string;
  month_visit_count: number;
  month_amount: number;
  month_tip: number;
};

/** 顧客一覧・顧客詳細で使う「今月値を合成した顧客」型 */
export type CustomerWithMonthStats = Customer & {
  month_visit_count: number;
  month_amount: number;
  month_tip: number;
  tags: Tag[];
};

export type CustomerAlias = {
  id: string;
  customer_id: string;
  alias: string;
  created_at: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type Visit = {
  id: string;
  primary_customer_id: string;
  visited_at: string;
  people_count: number;
  amount: number;
  tip: number;
  payment_method: PaymentMethod;
  seat_type: SeatType | null;
  receipt_required: boolean;
  receipt_name: string | null;
  memo: string | null;
  invalidated: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitMember = {
  id: string;
  visit_id: string;
  customer_id: string;
  member_type: "primary" | "companion";
  created_at: string;
};

export type Bottle = {
  id: string;
  customer_id: string;
  bottle_type: string | null;
  bottle_name: string;
  quantity: number;
  start_date: string;
  expiry_date: string;
  status: BottleStatus;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Champagne = {
  id: string;
  customer_id: string;
  visit_id: string | null;
  name: string;
  quantity: number;
  memo: string | null;
  created_by: string | null;
  created_at: string;
};

export type CautionLevel = "none" | "caution" | "banned";

export type Note = {
  id: string;
  customer_id: string;
  note: string;
  invalidated: boolean;
  created_by: string | null;
  created_at: string;
};

export type Reservation = {
  id: string;
  customer_id: string;
  reserved_at: string;
  people_count: number;
  bottle_plan: boolean;
  memo: string | null;
  status: ReservationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationMember = {
  id: string;
  reservation_id: string;
  customer_id: string;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: Partial<Customer> & { display_name: string };
        Update: Partial<Customer>;
        Relationships: [];
      };
      customer_aliases: {
        Row: CustomerAlias;
        Insert: Partial<CustomerAlias> & {
          customer_id: string;
          alias: string;
        };
        Update: Partial<CustomerAlias>;
        Relationships: [];
      };
      tags: {
        Row: Tag;
        Insert: Partial<Tag> & { name: string };
        Update: Partial<Tag>;
        Relationships: [];
      };
      customer_tags: {
        Row: { customer_id: string; tag_id: string };
        Insert: { customer_id: string; tag_id: string };
        Update: { customer_id?: string; tag_id?: string };
        Relationships: [
          {
            foreignKeyName: "customer_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      visits: {
        Row: Visit;
        Insert: Partial<Visit> & {
          primary_customer_id: string;
          visited_at: string;
        };
        Update: Partial<Visit>;
        Relationships: [];
      };
      visit_members: {
        Row: VisitMember;
        Insert: Partial<VisitMember> & {
          visit_id: string;
          customer_id: string;
        };
        Update: Partial<VisitMember>;
        Relationships: [];
      };
      bottles: {
        Row: Bottle;
        Insert: Partial<Bottle> & { customer_id: string; bottle_name: string };
        Update: Partial<Bottle>;
        Relationships: [];
      };
      notes: {
        Row: Note;
        Insert: Partial<Note> & { customer_id: string; note: string };
        Update: Partial<Note>;
        Relationships: [];
      };
      reservations: {
        Row: Reservation;
        Insert: Partial<Reservation> & {
          customer_id: string;
          reserved_at: string;
        };
        Update: Partial<Reservation>;
        Relationships: [];
      };
      reservation_members: {
        Row: ReservationMember;
        Insert: Partial<ReservationMember> & {
          reservation_id: string;
          customer_id: string;
        };
        Update: Partial<ReservationMember>;
        Relationships: [];
      };
      customer_views: {
        Row: { id: string; customer_id: string; viewed_by: string | null; viewed_at: string };
        Insert: { customer_id: string; viewed_by?: string | null };
        Update: { customer_id?: string; viewed_by?: string | null };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string; table_name: string };
        Update: never;
        Relationships: [];
      };
      champagnes: {
        Row: Champagne;
        Insert: Partial<Champagne> & { customer_id: string; name: string };
        Update: Partial<Champagne>;
        Relationships: [];
      };
    };
    Views: {
      customer_month_stats: {
        Row: CustomerMonthStats;
        Relationships: [];
      };
    };
    Functions: {
      search_customers: {
        Args: { p_query: string };
        Returns: { customer_id: string }[];
      };
      create_visit_with_details: {
        Args: {
          p_customer_id: string | null;
          p_is_new_customer: boolean;
          p_new_customer_name: string | null;
          p_visited_at: string;
          p_people_count: number;
          p_companion_names: string[];
          p_amount: number;
          p_tip: number;
          p_payment_method: string;
          p_seat_type: string | null;
          p_receipt_required: boolean;
          p_receipt_name: string | null;
          p_memo: string | null;
          p_tag_ids: string[];
          p_reservation_id: string | null;
          p_new_customer_kana: string | null;
          p_companion_kanas: string[];
          p_new_customer_birthday: string | null;
          p_companion_birthdays: string[];
        };
        Returns: { visit_id: string; customer_id: string };
      };
      create_reservation_with_details: {
        Args: {
          p_customer_id: string | null;
          p_is_new_customer: boolean;
          p_new_customer_name: string | null;
          p_reserved_at: string;
          p_people_count: number;
          p_companion_names: string[];
          p_bottle_plan: boolean;
          p_tag_ids: string[];
          p_memo: string | null;
          p_new_customer_kana: string | null;
          p_companion_kanas: string[];
        };
        Returns: { reservation_id: string; customer_id: string };
      };
    };
  };
};

// v1.1 追加テーブル（型定義）
export type StoreEventRow = {
  id: string;
  title: string;
  emoji: string;
  event_type: string;
  schedule_type: string;
  start_date: string | null;
  end_date: string | null;
  annual_month: number | null;
  annual_day: number | null;
  weekly_day: number | null;
  url: string | null;
  memo: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClosedDayRow = {
  id: string;
  date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type HolidayRow = {
  date: string;
  name: string;
};
