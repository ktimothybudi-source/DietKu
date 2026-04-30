import { cookies } from "next/headers";

const SESSION_COOKIE = "affiliate_session";

export function getSessionAffiliateId() {
  return cookies().get(SESSION_COOKIE)?.value || null;
}

export function setSessionCookie(response, affiliateId) {
  response.cookies.set(SESSION_COOKIE, affiliateId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
