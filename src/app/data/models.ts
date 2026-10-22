// Modelos del dominio que consume el frontend. La mayoría viene del cliente generado desde
// docs/openapi.json; aquí se declaran a mano solo las respuestas que el OpenAPI publica sin
// esquema (endpoints que devuelven ResponseEntity o listas de records anidados).
import type {
  JobResponse,
  JobStatus,
  RatingResponse,
  RepairRequestStatus,
  SlaState,
  Specialty,
  UrgencyLevel
} from '../api/generated';

export type {
  AcceptedQuotationResponse,
  CashSettlementDetail,
  CatalogItem,
  CatalogPage,
  ChecklistResult,
  ContractResponse,
  ContractStatus,
  CreateContractRequest,
  CreateProjectRequest,
  EarningResponse,
  EarningsResponse,
  ExpenseReport,
  FixerVerificationDocumentType,
  GeocodingCandidate,
  IndicatorsResponse,
  JobResponse,
  JobStatus,
  ListingType,
  ManagerOption,
  MediaPurpose,
  MessageResponse,
  NewProperty,
  NotificationResponse,
  OpenRequestSummaryResponse,
  OwnPortfolioResponse,
  OwnerDebtDetail,
  PaymentDetail,
  PaymentMethod,
  PaymentPurpose,
  PaymentSimulationOutcome,
  PaymentStatus,
  PayoutResponse,
  PieceResponse,
  ProjectResponse,
  ProjectSummaryResponse,
  PropertyChanges,
  PropertySearchResult,
  PropertySummary,
  PropertyType,
  PublicListingView,
  QuotationResponse,
  RatingResponse,
  RemodelingGoal,
  ReportablePropertyResponse,
  RepairRequestStatus,
  RequestDetailResponse,
  RequirementRequest,
  ReviewResponse,
  Role,
  SlaBoardItemResponse,
  SlaState,
  Specialty,
  UpdateContractRequest,
  UploadTicketDto,
  UrgencyLevel,
  VerificationResponse,
  VisitKind,
  VisitResponse,
  VisitStatus
} from '../api/generated';

export interface FixerProfile {
  fixerUserId: string;
  displayName: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  specialties: Specialty[];
  city: string | null;
  bio: string | null;
  yearsExperience: number | null;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface PendingVerification {
  fixerUserId: string;
  displayName: string;
  specialties: Specialty[];
  submittedAt: string;
}

export interface FixerReviews {
  fixerUserId: string;
  ratingAverage: number | null;
  ratingCount: number;
  /** Conteos de 1 a 5 estrellas, en ese orden. */
  distribution: number[];
  reviews: RatingResponse[];
}

export interface JobEvidence {
  id: string;
  mediaId: string;
  url: string | null;
  stage: 'BEFORE' | 'DURING' | 'AFTER';
  caption: string | null;
  createdAt: string;
}

export interface JobLogEntry {
  status: JobStatus;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface JobDetail {
  job: JobResponse;
  fixerName: string | null;
  evidence: JobEvidence[];
  log: JobLogEntry[];
}

export interface BoardItem {
  requestId: string;
  propertyId: string;
  propertyName: string | null;
  propertyCity: string | null;
  specialty: Specialty;
  title: string;
  status: RepairRequestStatus;
  urgencyLevel: UrgencyLevel;
  slaDeadline: string | null;
  slaState: SlaState;
  requestedByName: string | null;
  assignedFixerUserId: string | null;
  assignedFixerName: string | null;
  createdAt: string;
}

export interface Candidate {
  fixerUserId: string;
  displayName: string;
  city: string | null;
  sameCity: boolean;
  openJobs: number;
  ratingAverage: number | null;
  ratingCount: number;
  yearsExperience: number | null;
  score: number;
  invited: boolean;
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  status: string;
  roles: string[];
}
