// Thin wrapper around the Facebook JS SDK Embedded Signup flow.
//
// The flow:
//   1) Load the SDK script (once).
//   2) FB.init with our public Meta App ID.
//   3) FB.login with the Embedded Signup config_id (the "WhatsApp Embedded
//      Signup" configuration created in the Meta App dashboard).
//   4) Listen on window 'message' for the WA_EMBEDDED_SIGNUP event Meta posts
//      from the popup — it carries the chosen waba_id, phone_number_id, and
//      Meta business_id.
//   5) Hand both the auth `code` (from FB.login response.authResponse) AND the
//      message-channel IDs back to the backend's /embedded-signup endpoint.

export interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  metaBusinessId?: string;
}

interface FbAuthResponse {
  code?: string;
}

interface FbLoginResponse {
  status?: string;
  authResponse?: FbAuthResponse;
}

interface FbSdk {
  init(opts: { appId: string; version: string; xfbml?: boolean }): void;
  login(
    cb: (resp: FbLoginResponse) => void,
    opts: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras?: Record<string, unknown>;
    },
  ): void;
}

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FbSdk> | null = null;

function loadSdk(appId: string, version: string): Promise<FbSdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, version, xfbml: false });
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error("FB SDK loaded but window.FB is undefined"));
        return;
      }
      window.FB.init({ appId, version, xfbml: false });
      resolve(window.FB);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

interface WaSignupMessage {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  };
}

export async function runEmbeddedSignup(opts: {
  appId: string;
  configId: string;
  graphVersion: string;
}): Promise<EmbeddedSignupResult> {
  const fb = await loadSdk(opts.appId, opts.graphVersion);

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let signupData: WaSignupMessage["data"] | null = null;

    function onMessage(ev: MessageEvent) {
      if (typeof ev.data !== "string") {
        const msg = ev.data as WaSignupMessage;
        if (msg?.type === "WA_EMBEDDED_SIGNUP") {
          signupData = msg.data ?? null;
        }
        return;
      }
      try {
        const msg = JSON.parse(ev.data) as WaSignupMessage;
        if (msg.type === "WA_EMBEDDED_SIGNUP") {
          signupData = msg.data ?? null;
        }
      } catch {
        // not our message
      }
    }
    window.addEventListener("message", onMessage);

    fb.login(
      (response) => {
        window.removeEventListener("message", onMessage);
        const code = response.authResponse?.code;
        if (!code) {
          reject(new Error("Embedded Signup was cancelled"));
          return;
        }
        if (!signupData?.waba_id || !signupData?.phone_number_id) {
          reject(
            new Error(
              "Embedded Signup did not return a WABA / phone number — did the user finish the flow?",
            ),
          );
          return;
        }
        resolve({
          code,
          wabaId: signupData.waba_id,
          phoneNumberId: signupData.phone_number_id,
          metaBusinessId: signupData.business_id,
        });
      },
      {
        config_id: opts.configId,
        response_type: "code",
        override_default_response_type: true,
      },
    );
  });
}
