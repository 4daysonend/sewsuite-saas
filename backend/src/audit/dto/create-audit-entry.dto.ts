// src/audit/dto/create-audit-entry.dto.ts
export class CreateAuditEntryDto {
  userId?: string;
  action: string;
  targetId?: string;
  targetType: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}
