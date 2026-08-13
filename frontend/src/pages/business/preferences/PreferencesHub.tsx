import { Link } from "react-router-dom";
import { Card, IconTile, PageHeader } from "../../../components/ui";
import { Icon } from "../../../components/icons";
import type { IconName } from "../../../components/icons";

/** The owner-facing settings menu — each row opens a dedicated screen so no one
 *  page turns into a crowded wall of fields. Distinct from the operator-only
 *  business config (name/slug/widget/channels/team), which stays in admin. */
const SECTIONS: {
  to: string;
  icon: IconName;
  title: string;
  desc: string;
}[] = [
  {
    to: "contacts",
    icon: "phone",
    title: "אנשי קשר לסוכנים",
    desc: "טלפון ומייל לכל בעל תפקיד — הבסיס שממנו הסוכנים פונים ומזהים אותך.",
  },
  {
    to: "../notifications",
    icon: "bell",
    title: "התראות",
    desc: "באילו ערוצים לקבל עדכונים — אפליקציה, מייל, וואטסאפ.",
  },
  {
    to: "business",
    icon: "building",
    title: "פרטי העסק",
    desc: "התחום, הקהל, השירותים והטון — המידע שמזין את הסוכנים.",
  },
];

export default function PreferencesHub() {
  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-2xl mx-auto">
      <PageHeader
        eyebrow="הגדרות"
        title="ההגדרות שלי"
        subtitle="ניהול הפרטים שהסוכנים משתמשים בהם, וההעדפות שלך."
      />
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-cream-50">
              <IconTile icon={s.icon} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-navy-900">{s.title}</div>
                <div className="text-sm text-navy-400">{s.desc}</div>
              </div>
              <Icon
                name="chevron-start"
                size={18}
                className="shrink-0 text-navy-300 rtl:-scale-x-100"
              />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
