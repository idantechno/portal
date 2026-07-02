#!/usr/bin/env node
/**
 * WhatsApp Cloud API /register Failure Diagnostic
 * ------------------------------------------------
 * Goal: determine WHY POST /{phone_number_id}/register returns
 *       (#100) "your WhatsApp Business account is not verified"
 *       even though code_verification_status is VERIFIED.
 *
 * This script does NOT try to fix anything. It reads state from the
 * Graph API and prints a single verdict with the most likely cause
 * and the exact next action.
 *
 * Run:  node diagnose-whatsapp.mjs
 * Env:  ACCESS_TOKEN (required), PIN (required for the /register probe),
 *       WABA_ID, PHONE_NUMBER_ID, BUSINESS_ID (all optional — sensible
 *       defaults for the Portal Studio assets are baked in below).
 *
 * SECURITY: ACCESS_TOKEN and PIN are read from the environment ONLY.
 *           Do not hardcode them here or commit them anywhere.
 */

const GRAPH = "https://graph.facebook.com/v22.0";

const CFG = {
  // These IDs are not secrets — safe as defaults.
  wabaId: process.env.WABA_ID || "974706138717837",
  phoneId: process.env.PHONE_NUMBER_ID || "1212770285248847",
  businessId: process.env.BUSINESS_ID || "",
  // These ARE sensitive — env only, no fallback.
  token: process.env.ACCESS_TOKEN || "",
  pin: process.env.PIN || "",
};

const out = { findings: [], checks: {} };

function log(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

async function g(path, params = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", CFG.token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function post(path, body = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: CFG.token, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  if (!CFG.token) {
    console.error(
      "ERROR: set ACCESS_TOKEN env var (a System User or long-lived token with whatsapp_business_management + whatsapp_business_messaging)."
    );
    process.exit(1);
  }
  if (!CFG.pin) {
    console.warn(
      "WARN: PIN env var not set — the /register probe (CHECK 6) will be skipped. Set PIN to reproduce the exact error + fbtrace_id."
    );
  }

  console.log("WhatsApp Cloud API Diagnostic");
  console.log("WABA:", CFG.wabaId, "| Phone ID:", CFG.phoneId);

  // ---- CHECK 1: Token identity & scopes ----------------------------------
  const tokenDebug = await g("debug_token", { input_token: CFG.token });
  out.checks.token = tokenDebug.json?.data || tokenDebug.json;
  const tdata = tokenDebug.json?.data || {};
  const scopes = tdata.scopes || [];
  log("CHECK 1 — Token identity & scopes", {
    app_id: tdata.app_id,
    application: tdata.application,
    type: tdata.type,
    is_valid: tdata.is_valid,
    expires_at: tdata.expires_at,
    scopes,
  });
  for (const need of ["whatsapp_business_management", "whatsapp_business_messaging"]) {
    if (!scopes.includes(need)) out.findings.push(`MISSING SCOPE: ${need} not on this token.`);
  }

  // ---- CHECK 2: Phone number object — the single most important read -----
  const phone = await g(CFG.phoneId, {
    fields:
      "id,display_phone_number,verified_name,name_status,code_verification_status,quality_rating,platform_type,account_mode,status,messaging_limit_tier,certificate,is_official_business_account,is_on_biz_app",
  });
  out.checks.phone = phone.json;
  log("CHECK 2 — Phone number object", phone.json);

  const p = phone.json || {};
  const platformType = p.platform_type;       // CLOUD_API | ON_PREMISE | NOT_APPLICABLE
  const status = p.status;                    // CONNECTED | PENDING | ... | DISCONNECTED
  const nameStatus = p.name_status;           // APPROVED | AVAILABLE_WITHOUT_REVIEW | PENDING_REVIEW | DECLINED | NONE | EXPIRED
  const onBizApp = p.is_on_biz_app;           // true => SMB / Coexistence path

  // ---- CHECK 3: WABA object — account review + ownership -----------------
  const waba = await g(CFG.wabaId, {
    fields:
      "id,name,account_review_status,business_verification_status,ownership_type,is_enabled_for_insights,timezone_id,message_template_namespace,on_behalf_of_business_info,primary_funding_id",
  });
  out.checks.waba = waba.json;
  log("CHECK 3 — WABA object", waba.json);
  const reviewStatus = waba.json?.account_review_status; // APPROVED | PENDING | REJECTED
  const bizVerif = waba.json?.business_verification_status; // verified | not_verified | pending

  // ---- CHECK 4: Owning Business portfolio verification -------------------
  let bizObj = null;
  const obo = waba.json?.on_behalf_of_business_info;
  const bizId = CFG.businessId || obo?.id;
  if (bizId) {
    const biz = await g(bizId, {
      fields: "id,name,verification_status,is_disabled_for_integrations",
    });
    bizObj = biz.json;
    out.checks.business = biz.json;
    log("CHECK 4 — Business portfolio", biz.json);
  } else {
    log("CHECK 4 — Business portfolio", "No business id available. Set BUSINESS_ID to read it directly.");
  }

  // ---- CHECK 5: Subscribed apps on the WABA (webhook ownership) ----------
  const subs = await g(`${CFG.wabaId}/subscribed_apps`);
  out.checks.subscribed_apps = subs.json;
  log("CHECK 5 — Subscribed apps on WABA", subs.json);

  // ---- CHECK 6: The actual /register call, capturing fbtrace_id ----------
  // We re-run it deliberately to capture the precise sub-message + trace id.
  let regMsg = "";
  let regSub = "";
  let fbtrace = null;
  if (CFG.pin) {
    const reg = await post(`${CFG.phoneId}/register`, {
      messaging_product: "whatsapp",
      pin: CFG.pin,
    });
    out.checks.register = reg.json;
    log("CHECK 6 — /register response (captured)", reg.json);
    const regErr = reg.json?.error;
    regMsg = regErr?.message || "";
    regSub = regErr?.error_user_msg || regErr?.error_data?.details || "";
    fbtrace = regErr?.fbtrace_id;
    // A 200 / success with no error means register actually went through.
    if (reg.ok && !regErr) out.findings.push("REGISTER SUCCEEDED on this run — the number may now be live.");
  } else {
    log("CHECK 6 — /register response", "SKIPPED (no PIN env var set).");
  }

  // ======================================================================
  // VERDICT ENGINE
  // ======================================================================
  console.log("\n\n########## VERDICT ##########");

  // Scenario A: number is already connected → register is unnecessary / wrong call
  if (platformType === "CLOUD_API" && status === "CONNECTED") {
    verdict(
      "ALREADY REGISTERED",
      "The number is already platform_type=CLOUD_API and status=CONNECTED. /register is not needed and will error. Stop calling /register; the number is ready. Test by sending a template message to an allow-listed test number.",
      fbtrace
    );
  }

  // Scenario B: SMB / Coexistence path → /register is genuinely unavailable
  else if (onBizApp === true || /SMB|not available for SMB/i.test(regMsg)) {
    verdict(
      "SMB / COEXISTENCE PATH — /register UNAVAILABLE",
      "This number is on the WhatsApp Business *App* (Coexistence/SMB). The /register endpoint is not available for SMB numbers. You must onboard it through Embedded Signup as a Meta Tech Provider (App Review APPROVED on both whatsapp permissions, not just OAuth-granted). Standard Business Verification is also not supported for coexistence accounts. Either (1) get Tech Provider / App Review approval and use the Coexistence embedded flow, or (2) use a fresh number that was never on the Business App and register it cleanly via Cloud API.",
      fbtrace
    );
  }

  // Scenario C: App not approved via App Review (only OAuth granted)
  else if (reviewStatus && reviewStatus !== "APPROVED") {
    verdict(
      "WABA ACCOUNT REVIEW NOT APPROVED",
      `account_review_status = ${reviewStatus}. OAuth permission grant is NOT the same as App Review approval. Submit the app for App Review on whatsapp_business_management + whatsapp_business_messaging and wait for APPROVED. Until then /register is blocked.`,
      fbtrace
    );
  }

  // Scenario D: Business portfolio not verified for integrations
  else if (
    (bizObj && bizObj.verification_status && bizObj.verification_status !== "verified") ||
    bizVerif === "not_verified"
  ) {
    verdict(
      "BUSINESS PORTFOLIO NOT VERIFIED (API-level)",
      `The owning Business portfolio is not verified for API integrations (verification_status=${bizObj?.verification_status || bizVerif}). Note: this is API-level Business Verification, NOT the Personal Verification you completed and NOT 'Meta Verified' subscription. Go to Business Settings > Security Center > Business Verification for the portfolio that OWNS the WABA. If the UI says 'no need to verify', the WABA may be sitting in the wrong/personal portfolio — move the WABA into a properly verifiable Business portfolio.`,
      fbtrace
    );
  }

  // Scenario E: Display name not yet approved
  else if (nameStatus && !["APPROVED", "AVAILABLE_WITHOUT_REVIEW"].includes(nameStatus)) {
    verdict(
      "DISPLAY NAME NOT APPROVED",
      `name_status = ${nameStatus}. The display name ('Portal Studio') must be APPROVED or AVAILABLE_WITHOUT_REVIEW before the number can register. Resubmit the display name and wait for review.`,
      fbtrace
    );
  }

  // Fallback: the error persists with none of the above flags → support ticket
  else {
    verdict(
      "INCONCLUSIVE — OPEN META SUPPORT TICKET",
      `None of the deterministic flags fired. Open a Meta Business Help Center ticket quoting fbtrace_id=${fbtrace || "(none captured)"}. Include the full phone+WABA JSON above. Most-likely residual cause: the WABA needs hours/days to mature, or the WABA lives in a portfolio that cannot complete API-level verification.`,
      fbtrace
    );
  }

  // Always print the consolidated state table for the ticket
  console.log("\n--- STATE SUMMARY (paste into support ticket) ---");
  console.log(
    JSON.stringify(
      {
        app_id: tdata.app_id,
        token_valid: tdata.is_valid,
        token_scopes: scopes,
        platform_type: platformType,
        status,
        name_status: nameStatus,
        code_verification_status: p.code_verification_status,
        is_on_biz_app: onBizApp,
        account_review_status: reviewStatus,
        business_verification_status: bizVerif,
        portfolio_verification_status: bizObj?.verification_status,
        portfolio_id: bizId || null,
        register_error_message: regMsg,
        register_error_sub: regSub,
        fbtrace_id: fbtrace,
      },
      null,
      2
    )
  );

  console.log("\nFINDINGS:", out.findings.length ? out.findings : "none flagged");
}

function verdict(title, action, fbtrace) {
  console.log(`\nMOST LIKELY CAUSE: ${title}`);
  console.log(`NEXT ACTION: ${action}`);
  if (fbtrace) console.log(`fbtrace_id for support: ${fbtrace}`);
}

main().catch((e) => {
  console.error("Diagnostic crashed:", e);
  process.exit(1);
});
