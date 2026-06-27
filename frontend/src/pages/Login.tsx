import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/auth";
import { useAuthStore } from "../store/auth";
import { apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  FormError,
  Input,
  Label,
  Spinner,
} from "../components/ui";

export default function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      login(res.accessToken, res.user);
      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.loginFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gradient-to-br from-brand-50 via-cream-50 to-cream-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-display text-4xl text-navy-900 tracking-tight">
            Portal Studio
          </div>
          <div className="text-sm text-navy-400 mt-2">{t("tagline")}</div>
        </div>
        <Card className="p-7">
          <h1 className="text-xl font-semibold mb-6 text-navy-900">
            {t("auth.login")}
          </h1>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Spinner /> : t("auth.submitLogin")}
            </Button>
          </form>
        </Card>
        <div className="mt-5 text-center text-xs text-navy-400">
          <button
            className="hover:underline"
            onClick={() =>
              i18n.changeLanguage(i18n.language === "he" ? "en" : "he")
            }
          >
            {i18n.language === "he" ? "English" : "עברית"}
          </button>
        </div>
      </div>
    </div>
  );
}
