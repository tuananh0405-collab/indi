// ─── Ticket ───────────────────────────────────────────────────
export interface Ticket {
  _id: string;
  uuid: string;
  orderId: string;
  orderCode: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  ticketType: 'EARLY_BIRD' | 'STANDARD' | 'VIP';
  price: number;
  status: 'HOLDING' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  checkedIn: boolean;
  checkedInAt?: string;
  emailSent: boolean;
  emailSentAt?: string;
  notes: string;
  updatedBy: string;
  promoCode: string;
  createdAt: string;
  updatedAt: string;
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
  EARLY_BIRD: 'bg-blue-100 text-blue-700',
  STANDARD: 'bg-gray-100 text-gray-700',
  VIP: 'bg-amber-100 text-amber-700',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  HOLDING: 'Holding',
  EXPIRED: 'Expired',
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-red-100 text-red-700',
  HOLDING: 'bg-yellow-100 text-yellow-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};
