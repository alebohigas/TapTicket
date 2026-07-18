import type { Request } from "express";

export type AuditContext = {
  ipAddress?: string;
  userAgent?: string;
  source?: "NFC" | "QR" | "UNKNOWN";
};

export function requestAudit(
  request: Request,
  source?: AuditContext["source"],
): AuditContext {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0]?.trim();

  return {
    ipAddress: forwardedIp ?? request.ip,
    userAgent: request.get("user-agent")?.slice(0, 500),
    source,
  };
}

export function eventAuditData(audit?: AuditContext) {
  return {
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadataJson: audit?.source
      ? JSON.stringify({ source: audit.source })
      : undefined,
  };
}
