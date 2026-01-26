export type AuditEventType =
  | 'page_view'
  | 'section_view'
  | 'chat_opened'
  | 'chat_message_sent'
  | 'fit_assessment_started'
  | 'fit_assessment_completed'
  | 'fit_assessment_download'
  | 'external_link_click'
  | 'admin_login_success'
  | 'admin_login_failure'
  | 'admin_logout'
  | 'admin_chat_viewed'
  | 'admin_assessment_viewed'
  | 'admin_audit_accessed'
  | 'resume_generation_started'
  | 'resume_generation_completed'
  | 'resume_generation_download'
  | 'admin_resume_generation_viewed';

export interface AuditEvent {
  version: 1;
  eventId: string;
  eventType: AuditEventType;
  environment: string;
  timestamp: string;
  sessionId?: string;
  path: string;
  section?: string;
  metadata: Record<string, unknown>;
  userAgent?: string;
}
