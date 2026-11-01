export type WishStatus = "free" | "booked" | "fulfilled";
export type AdminRole = "super_admin" | "admin";

export type Bulb = {
  id: string;
  no: number;
  ward_id: string;
  name: string;
  age: number;
  status: WishStatus;
  mine: boolean;
};

export type TreeStats = {
  target: number;
  total: number;
  free: number;
  booked: number;
  fulfilled: number;
  lit: number;
  remaining: number;
};

export type TreeData = {
  bulbs: Bulb[];
  stats: TreeStats;
  paused: boolean;
  pause_message: string | null;
};

export type WishMedia = { id: string; path: string; title: string | null; mime_type: string | null };

export type WishCard = {
  id: string;
  no: number;
  ward_id: string;
  name: string;
  age: number;
  city: string | null;
  wish_title: string;
  description: string;
  status: WishStatus;
  photo_path: string | null;
  mine: boolean;
  media: WishMedia[];
};

export type MyBooking = {
  booking_id: string;
  state: "active" | "fulfilled";
  booked_at: string;
  expires_at: string | null;
  fulfilled_at: string | null;
  wish_id: string;
  no: number;
  ward_id: string;
  name: string;
  age: number;
  city: string | null;
  wish_title: string;
  description: string;
  status: WishStatus;
  photo_path: string | null;
  media: WishMedia[];
};

export type MyProfile = { email: string; display_name: string | null; slack: string | null; phone: string | null };

export type BookingResult = {
  booking_id: string;
  wish_id: string;
  ward_id: string;
  no: number;
  booked_at: string;
  expires_at: string | null;
};

export type HowStep = { title: string; body: string; note: string };
export type Banner = { url: string; title: string };

export type Settings = {
  general: { project_title: string; hero_title: string; hero_subtitle: string };
  about: { title: string; paragraphs: string[] };
  how: { title: string; steps: HowStep[]; finale: string };
  contacts_page: { title: string; subtitle: string };
  tree: {
    target_wishes: number;
    booking_hours: number;
    max_bookings_per_user: number;
    booking_paused: boolean;
    pause_message: string;
    counter: { label: string; show_gifts: boolean; show_free: boolean; show_progress: boolean };
  };
  messages: { booking_success: string; all_lit: string; drop_off: string };
  banners: { items: Banner[] };
};

export type Contact = { id: string; slack_handle: string; label: string; slack_url: string | null; sort_order: number };
export type PublicContent = { settings: Settings; contacts: Contact[] };

export type AdminWish = {
  id: string;
  no: number;
  ward_id: string;
  name: string;
  age: number;
  city: string | null;
  wish_title: string;
  description: string;
  status: WishStatus;
  hidden: boolean;
  photo_path: string | null;
  photo_public: boolean;
  admin_note: string | null;
  booked_by: string | null;
  booked_by_name: string | null;
  booked_at: string | null;
  expires_at: string | null;
};

export type AdminStats = {
  target: number;
  total: number;
  free: number;
  booked: number;
  fulfilled: number;
  hidden: number;
  remaining: number;
  by_day: { day: string; count: number }[];
};

export type AdminMedia = {
  id: string;
  wish_id: string;
  path: string;
  title: string | null;
  mime_type: string | null;
  is_public: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  slack: string | null;
  phone: string | null;
  count: number;
  last_booked_at: string;
  wishes: {
    wish_id: string;
    ward_id: string;
    name: string;
    age: number;
    wish_title: string;
    status: WishStatus;
    booked_at: string;
    expires_at: string | null;
  }[];
};

export type AuditRow = {
  id: number;
  at: string;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
};

export type AdminEntry = { email: string; role: AdminRole; created_at: string };
