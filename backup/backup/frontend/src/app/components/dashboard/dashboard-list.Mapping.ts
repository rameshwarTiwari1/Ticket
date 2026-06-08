// export const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Reopened', 'Closed'];
// export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

// export type TicketType = 'IT Services' | 'IMAC Request' | 'Security Incident';

// export interface ReasonConfig {
//   reason: string;
//   teams: string[];
// }

// export const TICKET_MAPPING: Record<TicketType, ReasonConfig[]> = {

//   // type_id = 1 → IT Services
//   'IT Services': [
//     { reason: 'Access Rights', teams: ['Admin'] },           // mapped_team_id = 1 → Admin
//     { reason: 'Hardware Issue', teams: ['Manager'] },        // mapped_team_id = 2 → Manager
//     { reason: 'Email Issue', teams: ['Manager'] },           // mapped_team_id = 2 → Manager
//     { reason: 'PRI Issue', teams: ['Manager'] },             // mapped_team_id = 2 → Manager
//     { reason: 'Network Issue', teams: ['Manager'] },         // mapped_team_id = 2 → Manager
//     { reason: 'Internet Issue', teams: ['Manager'] },        // mapped_team_id = 2 → Manager
//     { reason: 'Account Lock / Password Reset', teams: ['Admin'] }, // mapped_team_id = 1 → Admin
//   ],

//   // type_id = 2 → IMAC Request
//   'IMAC Request': [
//     { reason: 'Software Issue', teams: ['Manager'] },        // mapped_team_id = 2 → Manager
//     { reason: 'Database Issue', teams: ['Admin'] },          // mapped_team_id = 1 → Admin
//     { reason: 'Backup Issue', teams: ['Admin'] },            // mapped_team_id = 1 → Admin
//     { reason: 'SFTP Issue', teams: ['Admin'] },              // mapped_team_id = 1 → Admin
//   ],

//   // type_id = 3 → Security Incident
//   'Security Incident': [
//     { reason: 'Other Issue', teams: ['User'] },              // mapped_team_id = 3 → User
//   ]

// };

// export const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Reopened', 'Closed'];
// export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

// export type TicketType = 'IT Services' | 'IMAC Request' | 'Security Incident';

// export const TICKET_TYPES: TicketType[] = ['IT Services', 'IMAC Request', 'Security Incident'];

// export const ISSUE_OPTIONS: string[] = [
//   'Access Rights',
//   'Hardware Issue',
//   'Email Issue',
//   'PRI Issue',
//   'Network Issue',
//   'Internet Issue',
//   'Account Lock / Password Reset',
//   'Software Issue',
//   'Database Issue',
//   'Backup Issue',
//   'SFTP Issue',
//   'Other Issue',
// ];

// export const ASSIGNED_TO_TEAMS = ['IT/HELP_DESK', 'DBA'];

// export const ASSIGNED_TO_EMAIL_MAP: { [key: string]: string } = {
//   'IT/HELP_DESK': 'servicedesk@hansacequity.com',
//   'DBA': 'dbasupport@hansacequity.com',
// };

// // dashboard-list.Mapping.ts
// export const CLIENT_LOCATION_MAP: { [key: string]: string } = {
//   'HANSA CEQUITY': 'Mumbai Kurla',
//   'HANSA DIRECT': 'Mumbai Airoli',
//   'AUTOSENSE': 'Chennai',
// };

// // Reverse: location → organization (used for filtering tickets by user location)
// export const LOCATION_CLIENT_MAP: { [key: string]: string } = {
//   'Mumbai Kurla': 'HANSA CEQUITY',
//   'Mumbai Airoli': 'HANSA DIRECT',
//   'Chennai': 'AUTOSENSE',
// };

// // All valid organizations shown in the dropdown
// export const ORGANIZATIONS: string[] = ['HANSA CEQUITY', 'HANSA DIRECT', 'AUTOSENSE'];

// ─── TICKET STATUS — single source of truth, MIRRORS backend constants/roles.js ──
// Keep these in sync with backend/constants/roles.js (STATUS + TRANSITIONS).
export const TICKET_STATUSES = [
  'Pending Approval', 'Approved', 'Rejected',
  'Open', 'In Progress', 'On Hold',
  'Resolved', 'Closed', 'Reopened',
];

// Allowed next statuses per current status (lifecycle). Mirrors backend TRANSITIONS.
export const STATUS_TRANSITIONS: { [k: string]: string[] } = {
  'Pending Approval': ['Approved', 'Rejected'],
  'Approved':         ['In Progress', 'Open'],
  'Open':             ['In Progress', 'On Hold'],
  'In Progress':      ['On Hold', 'Resolved'],
  'On Hold':          ['In Progress', 'Resolved'],
  'Resolved':         ['Closed', 'Reopened'],
  'Reopened':         ['In Progress', 'On Hold'],
  'Rejected':         [],
  'Closed':           ['Reopened'],
};

// Dashboard tab/count buckets — every status belongs to exactly one bucket.
export const STATUS_BUCKETS: { open: string[]; wip: string[]; closed: string[] } = {
  open:   ['Open', 'Reopened', 'Pending Approval', 'Approved'],
  wip:    ['In Progress', 'On Hold'],
  closed: ['Closed', 'Resolved', 'Rejected'],
};

export const STATUS_OPTIONS = TICKET_STATUSES;

export const STATUS_OPTIONS_G = ['Open'];


export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

export type TicketType = 'IT Services' | 'IMAC Request' | 'Security Incident';
export const TICKET_TYPES: TicketType[] = ['IT Services', 'IMAC Request', 'Security Incident'];

export const HANSA_CEQUITY_ISSUES: string[] = [
  'Access Rights',
  'Hardware Issue',
  'Software Issue',
  'Database Issue',
  'Backup Issue',
  'Email Issue',
  'PRI Issue',
  'Network Issue',
  'Other Issue',
  'SFTP Issue',
  'Internet Issue',
  'Account Lock / Password Reset',
];

export const HANSA_DIRECT_AUTOSENSE_ISSUES: string[] = [
  'Headset Issue',
  'System Issue',
  'Domain ID Creation',
  'Domain ID Deactivation',
  'Shared Drive Access',
  'VPN Issue',
  'Salesforce Issue',
  'System Movement',
  'Outlook Issue',
  'Projector Setup',
  'Mouse Issue',
  'Keyboard Issue',
  'Monitor Issue',
  'Terminal ID Issue',
  'Change Request',
  'New System Setup',
  'Interdilog Setup',
  'CRM Issue',
  'Dialer Issue',
];

export const ORG_ISSUE_MAP: { [org: string]: string[] } = {
  'HANSA CEQUITY': HANSA_CEQUITY_ISSUES,
  'HANSA DIRECT':  HANSA_DIRECT_AUTOSENSE_ISSUES,
  'AUTOSENSE':     HANSA_DIRECT_AUTOSENSE_ISSUES,
};

export const ISSUE_OPTIONS: string[] = HANSA_CEQUITY_ISSUES;

export const ASSIGNED_TO_TEAMS = ['IT/HELP_DESK', 'DBA'];

export const ASSIGNED_TO_HANSA_CEQUITY = ['IT/HELP_DESK', 'DBA'];

export const ASSIGNED_TO_HANSA_DIRECT_AUTOSENSE = [
  'IT/HELP_DESK',
  'DBA',
  'CRM',
  'MIS'
];

export const ASSIGNED_TO_EMAIL_MAP: { [key: string]: string } = {
  'IT/HELP_DESK': 'servicedesk@hansacequity.com',
  'DBA': 'suraj.jogale@hansacequity.com',
};

//dbasupport@hansacequity.com

export const CLIENT_LOCATION_MAP: { [key: string]: string } = {
  'HANSA CEQUITY': 'Mumbai Kurla',
  'HANSA DIRECT':  'Mumbai Airoli',
  'AUTOSENSE':     'Chennai',
};

export const LOCATION_CLIENT_MAP: { [key: string]: string } = {
  'Mumbai Kurla':  'HANSA CEQUITY',
  'Mumbai Airoli': 'HANSA DIRECT',
  'Chennai':       'AUTOSENSE',
};

export const ORGANIZATIONS: string[] = ['HANSA CEQUITY', 'HANSA DIRECT', 'AUTOSENSE'];


export const ORG_WING_MAP: { [org: string]: string } = {
  'HANSA CEQUITY': 'Mumbai Kurla',
  'HANSA DIRECT':  'Mumbai Airoli',
  'AUTOSENSE':     'Chennai',
};

export const AIROLI_WINGS: string[] = ['A', 'B', 'C','D'];
