// ─── Ticket ───────────────────────────────────────────────────
export interface Ticket {
  _id: number;
  id: number;
  uuid: string;
  orderId: number;
  orderCode: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  ticketType: string;
  ticketTypeLabel: string;
  price: number;
  status: 'HOLDING' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'CANCELLED';
  checkedIn: boolean;
  checkedInAt?: string;
  checkedInBy?: string;
  emailSent: boolean;
  emailSentAt?: string;
  notes: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Ticket Type ──────────────────────────────────────────────
export interface TicketTypeInfo {
  id: number;
  label: string;
  price: number;
  capacity: number | null;
  sold: number;
}

// ─── Pagination ───────────────────────────────────────────────
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── API Responses ────────────────────────────────────────────
export interface TicketListResponse {
  success: boolean;
  data: {
    tickets: Ticket[];
    pagination: Pagination;
  };
}

export interface DashboardResponse {
  success: boolean;
  data: {
    capacity: number;
    sold: number;
    available: number;
    pending: number;
    checkedIn: number;
    totalRevenue: number;
    activeTickets: number;
    inactiveTickets: number;
    holdingTickets: number;
    ticketTypes: TicketTypeInfo[];
  };
}

export interface UpdateTicketResponse {
  success: boolean;
  data: {
    ticket: Ticket;
  };
}

// ─── Display Helpers ──────────────────────────────────────────
export const TICKET_TYPE_LABELS: Record<string, string> = {
  EARLY_BIRD: 'Early Bird',
  STANDARD: 'Standard',
  VIP: 'VIP',
};

export const TICKET_TYPE_COLORS: Record<string, string> = {
  EARLY_BIRD: 'bg-amber-100 text-amber-700',
  STANDARD: 'bg-blue-100 text-blue-700',
  VIP: 'bg-purple-100 text-purple-700',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  HOLDING: 'Holding',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-red-100 text-red-700',
  HOLDING: 'bg-yellow-100 text-yellow-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-orange-100 text-orange-700',
};
