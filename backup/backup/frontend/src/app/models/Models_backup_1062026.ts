// location

export interface Location {
  location_id?: number;
  location_name: string;
}

// wing

export interface Wing {
  wing_id?: number;
  wing_name: string;
  location_id: number;
  location_name?: string; // optional for display
}

// type

export interface Type {
  type_id: number;
  type_name: string;
}

export interface CreateTypePayload {
  type_name: string;
}

// status

export interface TicketStatus {
  status_id: number;
  status_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTicketStatusPayload {
  status_name: string;
}

// issues

export interface Issue {
  issue_id: number;
  issue_name: string;
  type_id: number;
  mapped_team_id: number;
}

export interface CreateIssuePayload {
  issue_name: string;
  type_id: number;
  mapped_team_id: number;
}

// teams

export interface Team {
  team_id?: number;        // optional for create
  team_name: string;
  location_id: number;
  location_name?: string;  // optional, from join with T_LOCATIONS
  created_at?: string;     // optional, from backend
}

// User

export interface User {
  id:           number;
  employeeId?:  string;
  firstName:    string;
  lastName:     string;
  email:        string;
  mobileNumber: string;
  teamName:     string;
  locationName: string | null;
  wingName:     string | null;
  orgId:        number | null;   // ← NEW
  orgName:      string | null;   // ← NEW
  wing_id: number|null;
}


export interface CreateUserPayload {
  employee_id: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  email_id: string;
  password?: string;
  team_name: string;
  // location_name?: string | null;
  // wing_name?: string | null;
  org_name: string | null;  // ← NEW
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

// Ticket

export interface GenerateTicket {
  ticket_id?: number;
  ticket_number?: string;
  subject: string;
  email_id: string;
  created_by_name: string;
  assigned_to_name: string;
  client_name?: string;
  assigned_to_email?: string;
  type_name: string;
  issue_name: string;
  team_name: string;
  status_name: string;
  priority: 'Low' | 'Medium' | 'High';
  description?: string | null;
  additional_email?: string | null;
  attachment?: File | null;
  org_name?: string | null;
  created_at?: string;
  updated_at?: string;
  sla_due_at?: string;
  wing_id?:number;
}
 
export interface MyTicket {
  ticket_id: number;
  ticket_number: string;
  subject: string;
  email_id: string;
  created_by_id: number;
  created_by_name: string;
  assigned_to_id: number | null;
  assigned_to_email?: string;
  assigned_to_name: string | null;
  client_name?: string;
  type_name: string;
  issue_name: string;
  team_name: string;
  status_name: string;
  priority: 'Low' | 'Medium' | 'High';
  description?: string | null;
  additional_email?: string | null;
  attachment?: string | null;
  org_id?: number | null;
  org_name?: string | null;
  locationName?: string | null;
  location_name?: string | null;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  sla_due_at?: string | null;
  // ── Approval fields ──────────────────────────────────────
  approval_status?: 'pending' | 'approved' | 'not_approved' | null;
  approval_token?:  string | null;
  approved_by?:     string | null;
  approved_at?:     string | null;
  approval_remark?: string | null;
}
 
export interface UpdateTicket {
  subject: string;
  email_id: string;
  priority: string;
  description: string;
  status_name: string;
  team_name: string;
  type_name: string;
  issue_name: string;
  assigned_to_name: string;
  assigned_to_email?: string;
  additional_email?: string | null;
  attachment?: File | null;
  org_name?: string | null;
  client_name?: string;
}

// ─── RESPONSE MODEL (what backend sends back) ─────────────────────────────────
export interface Client {
  client_id: number;
  client_name: string;
  created_at?: string;
  updated_at?: string;
}

// ─── REQUEST MODELS (what frontend sends to backend) ──────────────────────────
export interface CreateClientPayload {
  client_name: string;
}

export interface UpdateClientPayload {
  client_name: string;
}

export interface ResolveClientPayload {
  client_name: string;
}

// ─── API RESPONSE WRAPPERS ────────────────────────────────────────────────────
export interface ClientResponse {
  message: string;
  client: Client;
}

export interface ResolveClientResponse {
  client_id: number;
  client_name: string;
}

export interface DeleteClientResponse {
  message: string;
}

// Forget Password

export interface ForgotPasswordRequest {
  email: string;
  otp?: string;
  newPassword?: string;
}

// ── Organization ────────
export interface Organization {
  orgId:        number;
  orgName:      string;
  locationId:   number;
  locationName: string;
}

export interface TicketComment {
  comment_id:   number;
  ticket_id:    number;
  user_id:      number;
  user_name:    string;
  team_name:    string;
  comment_text: string;
  created_at:   string;
}