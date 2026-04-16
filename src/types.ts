
export interface Order {
  id: string | number;
  buyer: string;
  style: string;
  poNo: string;
  shipDate: string;
  color: string;
  orderQty: number;
}

export interface ProductionEntry {
  id: string | number;
  date: string;
  poNo: string;
  color: string;
  cut: number;
  sewOut: number;
  washR: number;
  finIn: number;
  finOut: number;
  poly: number;
  shipment: number;
  lineNo?: string;
  floor?: 'Woven' | 'Knit' | '';
  violations?: string[];
}

export interface POInfo {
  buyer: string;
  style: string;
  poNo: string;
  shipDate: string;
  colors: string[];
  totalQty: number;
  colorRows: Order[];
}

export type UserRole = 'super-admin' | 'admin' | 'supervisor' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'suspended';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  lastLogin: string;
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  details: string;
  path: string;
}

export interface SystemSettings {
  companyName: string;
  defaultRole: UserRole;
  maintenanceMode: boolean;
  dataRetentionDays: number;
}
