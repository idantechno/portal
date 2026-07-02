#!/usr/bin/env node
/**
 * Follow-up probes to disambiguate the #10 error on the WABA read.
 * Reads ACCESS_TOKEN from env only. No secrets hardcoded.
 */
const GRAPH = "https://graph.facebook.com/v22.0";
const TOKEN = process.env.ACCESS_TOKEN || "";
const WABA = process.env.WABA_ID || "974706138717837";
const PHONE = process.env.PHONE_NUMBER_ID || "1212770285248847";
const BIZ = process.env.BUSINESS_ID || "1473320497442855"; // portalstudioai portfolio

async function g(path, fields) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", TOKEN);
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return json;
}

function show(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

if (!TOKEN) { console.error("no ACCESS_TOKEN"); process.exit(1); }

// 1. Can we read the WABA AT ALL (minimal fields)? Distinguishes "no access"
//    from "BSP-gated field only".
show("WABA minimal (id,name,currency,timezone_id)",
  await g(WABA, "id,name,currency,timezone_id"));

// 2. Which specific fields trip #10 — review vs verification vs ownership.
show("WABA account_review_status only", await g(WABA, "account_review_status"));
show("WABA business_verification_status only", await g(WABA, "business_verification_status"));
show("WABA ownership_type + owner info", await g(WABA, "ownership_type,on_behalf_of_business_info,owner_business_info"));

// 3. The owning portfolio — settles H4 with a live value.
show("Business portfolio (verification_status, integrations flag)",
  await g(BIZ, "id,name,verification_status,is_disabled_for_integrations,created_time"));

// 4. Phone health/eligibility — often carries the precise blocking sub-reason.
show("Phone health_status", await g(PHONE, "health_status"));
show("Phone eligibility/throughput", await g(PHONE, "throughput,quality_score,account_mode,status,platform_type"));
