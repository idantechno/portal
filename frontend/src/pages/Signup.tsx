import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export default function Signup() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.signup({ name, email, password });
      login(res.accessToken, res.user);
      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.signupFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 via-neutral-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand-700">{t("appName")}</div>
          <div className="text-sm text-neutral-500 mt-1">{t("tagline")}</div>
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-semibold mb-6">{t("auth.signup")}</h1>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
              />
            </div>
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
                autoComplete="new-password"
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <FormError message={error} />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Spinner /> : t("auth.submitSignup")}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-neutral-600">
            {t("auth.haveAccount")}{" "}
            <Link
              to="/login"
              className="text-brand-700 hover:underline font-medium"
            >
              {t("auth.switchToLogin")}
            </Link>
          </div>
        </Card>
        <div className="mt-4 text-center text-xs text-neutral-500">
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
