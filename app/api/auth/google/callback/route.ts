import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google";
import { google } from "googleapis";
import { storeOwnerRefreshToken } from "@/lib/token-storage";
import { isUserAuthorized, recordUserLogin, authorizeUser, isSuperAdmin } from "@/lib/access-control";
import { saveCustomerRefreshToken, getCustomerByConnectToken } from "@/lib/customer-profile";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Authorization code not found" },
        { status: 400 }
      );
    }

    let customerToken = "";
    if (stateRaw) {
      try {
        const parsed = JSON.parse(stateRaw);
        customerToken = parsed.token || "";
      } catch {
        customerToken = stateRaw;
      }
    }

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Fetch user profile to check identity
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const profileResponse = await gmail.users.getProfile({
      userId: "me",
    });
    const email = (profileResponse.data.emailAddress || "").toLowerCase();

    const isOwner = isSuperAdmin(email);

    // --- Scenario A: Candidate Onboarding via 1-time Connect Token ---
    if (customerToken) {
      const customer = await getCustomerByConnectToken(customerToken);
      if (customer) {
        if (tokens.refresh_token) {
          await saveCustomerRefreshToken(email, tokens.refresh_token);
          // Also auto-whitelist them in allowed_users
          await authorizeUser(email, "candidate", "Automated candidate via connect link");
          console.log(`[Customer Connect] Refresh token saved for customer ${email} (Role: ${customer.role})`);
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectRes = NextResponse.redirect(
          `${appUrl}/connect/${customerToken}?status=connected`
        );

        if (tokens.refresh_token) {
          redirectRes.cookies.set("gmail_refresh_token", tokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        }
        return redirectRes;
      }
    }

    // --- Scenario B: Standard User / Superadmin Login ---
    // If user has a registered customer profile in DB, auto-save refresh token
    if (tokens.refresh_token) {
      await saveCustomerRefreshToken(email, tokens.refresh_token);
    }

    // Gatekeeper: Check if user is approved by Superadmin
    const authorized = await isUserAuthorized(email);
    if (!authorized) {
      console.warn(`[Access Gatekeeper] Unauthorized login attempt blocked: ${email}`);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return NextResponse.redirect(
        `${appUrl}/unauthorized?email=${encodeURIComponent(email)}`
      );
    }

    if (isOwner && tokens.refresh_token) {
      await storeOwnerRefreshToken(email, tokens.refresh_token);
      console.log(`Owner ${email} connected successfully and token stored.`);
    } else {
      await recordUserLogin(email);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = NextResponse.redirect(
      `${appUrl}/sent-emails?connected=true`
    );

    if (tokens.refresh_token) {
      response.cookies.set("gmail_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    if (tokens.access_token) {
      response.cookies.set("gmail_access_token", tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch (error: any) {
    console.error("Google callback error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Google callback failed",
      },
      { status: 500 }
    );
  }
}
