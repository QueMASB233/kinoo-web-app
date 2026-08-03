// ─── Enums ───────────────────────────────────────────────

export type PromotionType = "promotion" | "service"
export type PromotionStatus = "active" | "inactive" | "pending_review" | "rejected"
export type BenefitType = "discount" | "free_product" | "service" | "points_only"

// ─── Auth ────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user_id: string
  supabase_access_token?: string | null
  supabase_refresh_token?: string | null
}

export interface LoginRequest {
  email: string
}

export interface VerifyCodeRequest {
  email: string
  code: string
}

// ─── User ────────────────────────────────────────────────

export interface UserResponse {
  id: string
  full_name: string
  email: string
  profile_photo_url: string | null
  age: number | null
  gender_id: string | null
  gender_code: string | null
  country_id: string | null
  country_name: string | null
  city_id: string | null
  city_name: string | null
  role_id: string | null
  role_code: string | null
  status_id: string | null
  group_id: string | null
  group_name: string | null
  registration_step: number
  registration_completed: boolean
  version: number
  created_at: string
  referral_code: string | null
  referral_points: number
  referral_validated_count: number
  interest_codes: string[] | null
}

// ─── Promotion ───────────────────────────────────────────

export interface Promotion {
  id: string
  provider_id: string | null
  type: PromotionType
  title: string
  description: string | null
  benefit_type: BenefitType
  image_url: string | null
  link: string | null
  coupon_code: string | null
  redeem_message: string
  points_required: number
  country_id: string | null
  city_id: string | null
  targeting: Record<string, unknown>
  is_featured_eligible: boolean
  business_name: string | null
  business_address: string | null
  business_phone: string | null
  business_email: string | null
  business_whatsapp: string | null
  service_price: number | null
  is_presential: boolean
  is_referral_only: boolean
  min_referral_points_required: number
  points_cost: number
  stock_total: number | null
  stock_remaining: number | null
  is_single_use_per_user: boolean
  start_date: string
  end_date: string
  is_active: boolean
  status: PromotionStatus
  deactivated_at: string | null
  deactivation_reason: string | null
  admin_suspended: boolean
  admin_suspended_at: string | null
  admin_suspended_reason: string | null
  created_at: string
  updated_at: string
  redemptions_count: number
}

export interface CreatePromotionRequest {
  provider_id?: string | null
  type?: PromotionType
  title: string
  description?: string | null
  benefit_type: BenefitType
  image_url?: string | null
  link?: string | null
  coupon_code?: string | null
  redeem_message?: string | null
  points_required?: number
  country_id?: string | null
  city_id?: string | null
  targeting?: Record<string, unknown>
  is_featured_eligible?: boolean
  business_name?: string | null
  business_address?: string | null
  business_phone?: string | null
  business_email?: string | null
  business_whatsapp?: string | null
  service_price?: number | null
  is_presential?: boolean
  is_referral_only?: boolean
  min_referral_points_required?: number
  points_cost?: number
  stock_total?: number | null
  is_single_use_per_user?: boolean
  start_date: string
  end_date: string
  is_active?: boolean
  status?: PromotionStatus
}

export interface UpdatePromotionRequest {
  type?: PromotionType | null
  title?: string | null
  description?: string | null
  benefit_type?: BenefitType | null
  image_url?: string | null
  link?: string | null
  coupon_code?: string | null
  redeem_message?: string | null
  points_required?: number | null
  country_id?: string | null
  city_id?: string | null
  targeting?: Record<string, unknown> | null
  is_featured_eligible?: boolean | null
  business_name?: string | null
  business_address?: string | null
  business_phone?: string | null
  business_email?: string | null
  business_whatsapp?: string | null
  service_price?: number | null
  is_presential?: boolean | null
  is_referral_only?: boolean | null
  min_referral_points_required?: number | null
  points_cost?: number | null
  stock_total?: number | null
  stock_remaining?: number | null
  is_single_use_per_user?: boolean | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean | null
  status?: PromotionStatus | null
  deactivated_at?: string | null
  deactivation_reason?: string | null
}

// ─── Places & Locations ─────────────────────────────────

export interface PlaceResult {
  id: string
  place_id: string
  address: string | null
  city: string | null
  country: string | null
  lat: number
  lng: number
  source: "cache" | "google"
}

export type CoverageType = "point" | "city"

export interface PromotionLocation {
  id: string
  promotion_id: string
  coverage_type: CoverageType
  place: PlaceResult
  created_at: string
  credits_charged?: number | string | null
  balance_after?: number | string | null
}

export interface AdCreditLocationPricing {
  point_credits: number | string
  city_credits: number | string
  currency_equivalent: string
  credits_per_usd: number | string
}

// ─── Admin Dashboard ────────────────────────────────────

export interface CountByLabel {
  label: string
  count: number
}

export interface DashboardSummary {
  total_users: number
  total_pets: number
  total_dogs: number
  total_cats: number
  total_promotions: number
  active_promotions: number
  total_redemptions: number
  total_referrals: number
  validated_referrals: number
  total_points_issued: number
  total_points_spent: number
  active_emergency_credits: number
  total_ai_conversations: number
  total_ai_messages: number
  users_registered_last_30d: number
  pets_registered_last_30d: number
}

export interface UsersAnalytics {
  total: number
  by_role: CountByLabel[]
  by_gender: CountByLabel[]
  by_country: CountByLabel[]
  by_city: CountByLabel[]
  registrations_by_month: CountByLabel[]
  registration_step_distribution: CountByLabel[]
  completed_registration_count: number
  avg_age: number | null
  notification_permission_granted: number
  location_permission_granted: number
}

export interface PetsAnalytics {
  total: number
  by_species: CountByLabel[]
  top_dog_breeds: CountByLabel[]
  top_cat_breeds: CountByLabel[]
  by_sex: CountByLabel[]
  sterilized_count: number
  not_sterilized_count: number
  avg_age_years: number | null
  registrations_by_month: CountByLabel[]
  health_score_distribution: CountByLabel[]
  health_category_distribution: CountByLabel[]
}

export interface PromotionsAnalytics {
  total: number
  active: number
  inactive: number
  by_type: CountByLabel[]
  by_status: CountByLabel[]
  total_redemptions: number
  redemptions_by_status: CountByLabel[]
  redemptions_by_month: CountByLabel[]
  top_redeemed: CountByLabel[]
}

export interface PointsAnalytics {
  total_issued: number
  total_spent: number
  net_circulation: number
  by_source_type: CountByLabel[]
  transactions_by_month: CountByLabel[]
  top_earners: CountByLabel[]
}

export interface ReferralsAnalytics {
  total: number
  by_status: CountByLabel[]
  conversion_rate: number
  referrals_by_month: CountByLabel[]
  top_referrers: CountByLabel[]
}

export interface AdminReferralCode {
  id: string
  code: string
  title: string
  description?: string | null
  is_active: boolean
  usage_count: number
  max_uses?: number | null
  expires_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface AdminCreateReferralCodeRequest {
  code: string
  title: string
  description?: string
  max_uses?: number
  expires_at?: string
}

export interface AdminUpdateReferralCodeRequest {
  title?: string
  description?: string | null
  is_active?: boolean
  max_uses?: number | null
  expires_at?: string | null
}

export interface EngagementAnalytics {
  total_conversations: number
  total_messages: number
  avg_messages_per_conversation: number
  conversations_by_month: CountByLabel[]
  top_interests: CountByLabel[]
  top_care_preferences: CountByLabel[]
}

export interface EmergencyCreditsAnalytics {
  total_credits: number
  active: number
  inactive: number
  activations_by_month: CountByLabel[]
}

export interface AuditLogEntry {
  id: string
  table_name: string
  record_id: string
  action: "INSERT" | "UPDATE" | "DELETE"
  old_values: unknown | null
  new_values: unknown | null
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[]
  total: number
  page: number
  limit: number
}

export interface EventEntry {
  id: string
  event_type: string
  entity_id: string
  entity_type: string
  payload: unknown | null
  created_at: string
}

export interface PaginatedEvents {
  data: EventEntry[]
  total: number
  page: number
  limit: number
}

export interface ActiveCreditUser {
  credit_id: string
  user_id: string
  user_name: string
  user_email: string
  status: string
  activated_at: string | null
  deactivated_at: string | null
  call_initiated_at?: string | null
  close_reason?: string | null
  amount_usd?: number | null
  paid_at?: string | null
  order_id?: string | null
}

export interface PaginatedActiveCredits {
  data: ActiveCreditUser[]
  total: number
  page: number
  limit: number
}

export interface PromotionReviewAction {
  action: "approve" | "reject"
  reason?: string
}

// ─── Knowledge Base ─────────────────────────────────────

export interface KnowledgeDocumentResponse {
  id: string
  title: string
  description: string | null
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  category: string | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  status: "processing" | "ready" | "error"
  chunk_count: number
  doc_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface KnowledgeChunkResponse {
  id: string
  document_id: string
  chunk_index: number
  content: string
  summary: string | null
  token_count: number | null
  has_embedding: boolean
  chunk_metadata: Record<string, unknown>
  created_at: string
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentResponse {
  chunks: KnowledgeChunkResponse[]
}

export interface PaginatedKnowledgeDocuments {
  data: KnowledgeDocumentResponse[]
  total: number
  page: number
  limit: number
}

export interface KnowledgeDocumentUpdate {
  title?: string
  description?: string
  category?: string
}

// ─── Lookup ──────────────────────────────────────────────

export interface Country {
  id: string
  name: string
}

export interface City {
  id: string
  name: string
  country_id: string
}

export interface Breed {
  id: string
  name: string
  species_id?: string
}

// ─── Pet Targeting ──────────────────────────────────────

// API value lists. Backend valida con 422 si llega algo fuera de estos sets.
export const PET_SEX_VALUES = ["male", "female"] as const
export const PET_SPECIES_VALUES = ["dog", "cat"] as const
export const PET_AGE_VALUES = ["puppy", "adult", "senior"] as const

export type PetSex = (typeof PET_SEX_VALUES)[number]
export type PetSpecies = (typeof PET_SPECIES_VALUES)[number]
export type PetAgeCategory = (typeof PET_AGE_VALUES)[number]

export interface PetFilters {
  species?: string[]
  sex?: string[]
  age_categories?: string[]
  breeds?: string[]
  health?: string
  vaccinated?: boolean
  sterilized?: boolean
  dewormed_internal?: boolean
  dewormed_external?: boolean
  takes_medication?: boolean
  weight_status?: string[]
  behavior?: {
    aggressive?: boolean
    separation_anxiety?: boolean
    phobias?: boolean
  }
  identification?: {
    has_collar_id?: boolean
    has_microchip?: boolean
  }
  supplements?: {
    has_vitamins?: boolean
    has_supplements?: boolean
  }
}

// ─── User Targeting ─────────────────────────────────────

export const USER_GENDER_VALUES = [
  "female",
  "male",
  "other",
  "prefer_not_say",
] as const
export const USER_PET_MEANING_VALUES = [
  "adopcion",
  "rescatista",
  "mis_hijos",
  "parte_de_mi_familia",
  "compania",
  "solo_mis_mascotas",
  "companero_de_trabajo",
  "terapia",
] as const

export type UserGender = (typeof USER_GENDER_VALUES)[number]
export type UserPetMeaning = (typeof USER_PET_MEANING_VALUES)[number]

export interface UserFilters {
  pet_meanings?: string[]
  genders?: string[]
}

// ─── Provider ad credits ─────────────────────────────────

export type ProviderCreditOrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"

export type ProviderCreditLedgerType =
  | "purchase"
  | "spend"
  | "refund"
  | "adjustment"

export interface CreditPack {
  id: string
  label: string
  amount_usd: number | string
  credits: number | string
  description: string
}

export interface CustomPurchaseSettings {
  enabled: boolean
  credits_per_usd: number | string
  min_credits: number | string
  max_credits: number | string
}

export interface CreditPackListResponse {
  packs: CreditPack[]
  currency: string
  credits_per_usd: number | string
  custom_purchase?: CustomPurchaseSettings
}

export interface ProviderCreditBalance {
  provider_id: string
  balance_credits: number | string
  currency_equivalent: string
  updated_at: string | null
}

export interface ProviderCreditLedgerEntry {
  id: string
  provider_id: string
  order_id: string | null
  type: ProviderCreditLedgerType
  amount_credits: number | string
  balance_after: number | string
  description: string | null
  created_at: string
}

export interface ProviderCreditTransactionList {
  items: ProviderCreditLedgerEntry[]
  total: number
  limit: number
  offset: number
}

export interface ProviderCreditOrder {
  id: string
  provider_id: string
  pack_id: string
  amount_usd: number | string
  credits_to_grant: number | string
  status: ProviderCreditOrderStatus
  nuvei_reference: string | null
  nuvei_transaction_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  checkout_url?: string | null
}

export interface ProviderCreditOrderCreateResponse {
  order: ProviderCreditOrder
  checkout_url: string | null
  message: string
}

export interface AdminProviderCreditOrder extends ProviderCreditOrder {
  provider_name: string
  provider_email: string
}

export interface AdminProviderCreditOrderList {
  items: AdminProviderCreditOrder[]
  total: number
  limit: number
  offset: number
}

export interface ProviderCreditOrderRefundResponse {
  order: ProviderCreditOrder
  ledger_entry: ProviderCreditLedgerEntry
  message: string
}

// ─── Promotion paid orders (reservas) ────────────────────

export type PromotionPaidOrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"

export type PromotionOrderFulfillmentStatus =
  | "scheduled"
  | "submitted"
  | "verified"
  | "rejected"

export type PromotionOrderFulfillmentPhase =
  | "not_applicable"
  | "pending_contact"
  | "scheduled"
  | "submitted"
  | "verified"
  | "rejected"

export interface PromotionOrderFulfillment {
  id: string
  order_id: string
  provider_id: string
  status: PromotionOrderFulfillmentStatus
  contact_confirmed_at: string | null
  scheduling_notes: string | null
  photo_url: string | null
  delivery_description: string | null
  submitted_at: string | null
  reviewed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface PromotionPaidOrder {
  id: string
  promotion_id: string
  provider_id: string
  buyer_user_id: string
  pet_id: string | null
  pet_name_snapshot: string | null
  pet_photo_url_snapshot: string | null
  amount_usd: number | string
  currency: string
  status: PromotionPaidOrderStatus
  nuvei_reference: string | null
  nuvei_transaction_id: string | null
  paid_at: string | null
  buyer_full_name: string
  buyer_email: string
  buyer_phone: string | null
  promotion_title_snapshot: string
  promotion_type_snapshot: string | null
  benefit_type_snapshot: string | null
  provider_business_name: string | null
  provider_phone: string | null
  provider_whatsapp: string | null
  provider_address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  checkout_url?: string | null
  fulfillment_phase?: PromotionOrderFulfillmentPhase | null
  fulfillment?: PromotionOrderFulfillment | null
}

export interface PromotionPaidOrderListResponse {
  items: PromotionPaidOrder[]
  total: number
  limit: number
  offset: number
}

export interface AdminPromotionOrderFulfillment extends PromotionOrderFulfillment {
  promotion_title_snapshot: string
  amount_usd: number | string
  buyer_full_name: string
  buyer_email: string
  buyer_phone?: string | null
  provider_name: string
  provider_email: string
  provider_business_name?: string | null
  paid_at?: string | null
  nuvei_transaction_id?: string | null
}

export interface AdminPromotionOrderFulfillmentDetail
  extends AdminPromotionOrderFulfillment {
  buyer_user_id: string
  promotion_id: string
}

export interface AdminPromotionOrderFulfillmentList {
  items: AdminPromotionOrderFulfillment[]
  total: number
  limit: number
  offset: number
}

export interface PromotionFulfillmentReviewAction {
  status: "verified" | "rejected"
  admin_notes?: string | null
}

export interface AdminProviderOption {
  id: string
  full_name: string
  email: string
}

export interface AdminProviderListItem extends AdminProviderOption {
  status_code: "active" | "blocked" | "suspended"
  email_verified: boolean
  account_activated: boolean
  balance_credits: string
  created_at: string | null
}

export interface AdminProviderList {
  items: AdminProviderListItem[]
  total: number
  page: number
  limit: number
}

export interface AdminCreateProviderRequest {
  full_name: string
  email: string
  initial_credits?: number
}

export interface AdminCreateProviderResponse {
  id: string
  full_name: string
  email: string
  status_code: "active" | "blocked" | "suspended"
  email_verified: boolean
  account_activated: boolean
  initial_credits: string
  welcome_email_sent: boolean
}

export type ProviderStatusCode = "active" | "blocked" | "suspended"

export interface AdminUpdateProviderRequest {
  full_name?: string
  email?: string
  status_code?: ProviderStatusCode
}

export interface AdminUpdateProviderResponse {
  id: string
  full_name: string
  email: string
  status_code: ProviderStatusCode
  email_verified: boolean
  account_activated: boolean
  balance_credits: string
  created_at: string | null
}

export type AppUserRoleCode = "owner" | "member"

export interface AdminAppUserListItem {
  id: string
  full_name: string
  email: string
  role_code: AppUserRoleCode
  status_code: "active" | "blocked" | "suspended"
  email_verified: boolean
  registration_completed: boolean
  referral_points: number
  created_at: string | null
  last_login_at: string | null
}

export interface AdminAppUserList {
  items: AdminAppUserListItem[]
  total: number
  page: number
  limit: number
}

export type AppUserStatusCode = "active" | "blocked" | "suspended"

export interface AdminUpdateAppUserRequest {
  status_code: AppUserStatusCode
}

export type AdminUpdateAppUserResponse = AdminAppUserListItem
