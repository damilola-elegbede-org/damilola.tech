export interface AdminSession {
  authenticated: boolean;
  exp: number;  // JWT expiry timestamp
}

export interface AdminTokenPayload {
  iat: number;
  exp: number;
}
