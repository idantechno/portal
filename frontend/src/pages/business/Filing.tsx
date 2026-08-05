import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import { type FiledDocument, filingApi } from "../../api/filing";
import { agentsApi } from "../../api/agents";
import { type Quote, quotesApi } from "../../api/quotes";
import { type DesignKind, type DesignProduct, designerApi } from "../../api/designer";
import {
  Button,
  Card,
  EmptyState,
  FormError,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { Icon, type IconName } from "../../components/icons";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type Tab = "docs" | "quotes" | "designs";

const DESIGN_KIND_LABEL: Record<DesignKind, string> = {
  menu: "תפריט",
  poster: "כרזה",
  invitation: "הזמנה",
  pricelist: "מחירון",
  flyer: "פלייר",
  other: "מוצר",
};

/**
 * מסמכים — the single, obvious document library for the owner. Uploads and
 * agent-generated documents land here; the other agents' outputs (quotes,
 * print-ready designs) are surfaced as sibling tabs so there is one place to
 * find everything the business has produced. The creator agents stay the place
 * to MAKE these — here we only list and link into them.
 */
export default function Filing() {
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [tab, setTab] = useState<Tab>("docs");

  const agents = useQuery({
    queryKey: ["business", businessId, "agents"],
    queryFn: () => agentsApi.forBusiness(businessId),
    enabled: Boolean(businessId),
  });
  const entitled = (key: string) =>
    (agents.data ?? []).some((a) => a.key === key);
  const hasQuotes = entitled("quote");
  const hasDesigns = entitled("designer");

  const tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: "docs", label: "מסמכים", icon: "doc" },
    ...(hasQuotes
      ? [{ key: "quotes" as const, label: "הצעות מחיר", icon: "receipt" as IconName }]
      : []),
    ...(hasDesigns
      ? [{ key: "designs" as const, label: "עיצובים", icon: "palette" as IconName }]
      : []),
  ];

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <PageHeader
        title="מסמכים"
        subtitle="הספרייה של העסק — כל המסמכים במקום אחד. מה שתעלה ומה שהסוכנים מפיקים (הזמנות עבודה, הצעות מחיר, עיצובים) נאסף כאן."
      />

      {tabs.length > 1 && (
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-navy-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "docs" && <DocsTab businessId={businessId} />}
      {tab === "quotes" && hasQuotes && <QuotesTab businessId={businessId} />}
      {tab === "designs" && hasDesigns && <DesignsTab businessId={businessId} />}
    </div>
  );
}

function DocsTab({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [folder, setFolder] = useState("כללי");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = useQuery({
    queryKey: ["filing", businessId],
    queryFn: () => filingApi.list(businessId),
    enabled: Boolean(businessId),
  });
  const folders = useQuery({
    queryKey: ["filing", businessId, "folders"],
    queryFn: () => filingApi.folders(businessId),
    enabled: Boolean(businessId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["filing", businessId] });

  const upload = useMutation({
    mutationFn: (v: { file: File; folder: string }) =>
      filingApi.upload(businessId, v.file, v.folder),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, "ההעלאה נכשלה")),
  });
  const move = useMutation({
    mutationFn: (v: { id: string; folder: string }) =>
      filingApi.move(businessId, v.id, v.folder),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => filingApi.remove(businessId, id),
    onSuccess: invalidate,
  });

  const handleFiles = (list: FileList | File[]) => {
    setError(null);
    const f = folder.trim() || "כללי";
    Array.from(list).forEach((file) => upload.mutate({ file, folder: f }));
  };

  const all = files.data ?? [];
  const folderNames = [
    ...new Set([...(folders.data ?? []), ...all.map((f) => f.folder)]),
  ];

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-navy-600 shrink-0">תיקייה:</label>
          <input
            list="filing-folders"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="בחר או הקלד תיקייה חדשה"
            className="flex-1 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <datalist id="filing-folders">
            {folderNames.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
          className={`w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? "border-brand-400 bg-brand-50"
              : "border-navy-200 bg-cream-50 hover:border-brand-300"
          }`}
        >
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-400 shadow-[var(--shadow-e1)]">
            <Icon name="upload" size={21} />
          </div>
          <div className="text-sm font-medium text-navy-700">
            גרור לכאן מסמכים או לחץ לבחירה
          </div>
          <div className="text-xs text-navy-400 mt-0.5">
            ייכנסו לתיקייה "{folder.trim() || "כללי"}"
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <FormError message={error} />
        {upload.isPending && (
          <div className="mt-2 flex items-center gap-2 text-sm text-navy-400">
            <Spinner /> מעלה...
          </div>
        )}
      </Card>

      {files.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!files.isLoading && all.length === 0 && (
        <Card>
          <EmptyState
            icon="folder"
            title="עדיין אין מסמכים"
            text="גרור לכאן את המסמך הראשון של העסק, או העלה אותו מהמחשב."
            action={
              <Button icon="upload" onClick={() => fileInputRef.current?.click()}>
                העלה מסמך
              </Button>
            }
          />
        </Card>
      )}

      <div className="space-y-6">
        {folderNames.map((name) => {
          const items = all.filter((f) => f.folder === name);
          if (items.length === 0) return null;
          return (
            <div key={name}>
              <h2 className="text-sm font-semibold text-navy-700 mb-2 flex items-center gap-2">
                <Icon name="folder" size={16} className="text-brand-400" />
                {name}
                <span className="text-xs font-normal text-navy-400">
                  ({items.length})
                </span>
              </h2>
              <Card className="divide-y divide-navy-50 overflow-hidden">
                {items.map((doc) => (
                  <FileRow
                    key={doc.id}
                    doc={doc}
                    businessId={businessId}
                    folders={folderNames}
                    onMove={(f) => move.mutate({ id: doc.id, folder: f })}
                    onRemove={() => remove.mutate(doc.id)}
                    removing={remove.isPending && remove.variables === doc.id}
                  />
                ))}
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
}

function FileRow({
  doc,
  businessId,
  folders,
  onMove,
  onRemove,
  removing,
}: {
  doc: FiledDocument;
  businessId: string;
  folders: string[];
  onMove: (folder: string) => void;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <a
        href={filingApi.downloadUrl(businessId, doc.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 group"
      >
        <div className="text-sm font-medium text-navy-800 truncate group-hover:text-brand-700">
          {doc.filename}
        </div>
        <div className="text-xs text-navy-400">
          {formatBytes(doc.size)}
          {doc.source === "agent" && " · הופק ע״י הסוכן"}
        </div>
      </a>
      <Select
        value={doc.folder}
        onChange={(e) => onMove(e.target.value)}
        wrapperClassName="shrink-0 w-32 sm:w-40"
        title="העבר לתיקייה"
      >
        {folders.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </Select>
      <button
        onClick={onRemove}
        disabled={removing}
        className="text-xs text-navy-400 hover:text-red-600 disabled:opacity-50 shrink-0"
      >
        {removing ? "מוחק..." : "מחק"}
      </button>
    </div>
  );
}

/**
 * Read-only view of the quotes the quote agent produced. Listing reuses the
 * business-scoped quotes API; each row links to the existing QuoteDetail editor,
 * and "הצעה חדשה" routes to the quote agent (the creator). No quote logic here.
 */
function QuotesTab({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const quotes = useQuery({
    queryKey: ["quotes", businessId],
    queryFn: () => quotesApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const list = quotes.data ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-navy-500">
          הצעות המחיר שהסוכן הכין. פתח הצעה לעריכה, לשיתוף או להורדה.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          className="shrink-0"
          onClick={() =>
            navigate(`/app/businesses/${businessId}/agents/quote`)
          }
        >
          הצעה חדשה
        </Button>
      </div>

      {quotes.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!quotes.isLoading && list.length === 0 && (
        <Card>
          <EmptyState
            icon="receipt"
            title="אין עדיין הצעות מחיר"
            text="צור הצעת מחיר חדשה בסוכן הצעות המחיר."
            action={
              <Button
                icon="plus"
                onClick={() =>
                  navigate(`/app/businesses/${businessId}/agents/quote`)
                }
              >
                לסוכן הצעות מחיר
              </Button>
            }
          />
        </Card>
      )}

      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((q) => (
            <QuoteRow key={q.id} quote={q} businessId={businessId} />
          ))}
        </div>
      )}
    </>
  );
}

function QuoteRow({ quote, businessId }: { quote: Quote; businessId: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/app/businesses/${businessId}/quotes/${quote.id}`)}
      className="w-full text-start"
    >
      <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-e2)]">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            quote.status === "approved"
              ? "bg-teal-50 text-teal-700 ring-teal-200"
              : "bg-coral-50 text-coral-600 ring-coral-200"
          }`}
        >
          {quote.status === "approved" ? "מאושרת" : "טיוטה"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-navy-900">
            {quote.title}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {quote.total ? quote.total : "ללא סכום"}
          </div>
        </div>
        <Icon
          name="chevron-start"
          size={16}
          className="shrink-0 text-navy-300"
        />
      </Card>
    </button>
  );
}

/**
 * Read-only view of the print-ready designs the designer agent produced.
 * Designs have no editor page — each is a rendered PDF — so rows open the PDF
 * directly. "עיצוב חדש" routes to the designer agent (the creator).
 */
function DesignsTab({ businessId }: { businessId: string }) {
  const navigate = useNavigate();
  const designs = useQuery({
    queryKey: ["designs", businessId],
    queryFn: () => designerApi.list(businessId),
    enabled: Boolean(businessId),
  });

  const list = designs.data ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-navy-500">
          העיצובים המוכנים להדפסה שהסוכן הכין. לחץ כדי לפתוח או להוריד PDF.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          className="shrink-0"
          onClick={() =>
            navigate(`/app/businesses/${businessId}/agents/designer`)
          }
        >
          עיצוב חדש
        </Button>
      </div>

      {designs.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {!designs.isLoading && list.length === 0 && (
        <Card>
          <EmptyState
            icon="palette"
            title="אין עדיין עיצובים"
            text="צור תפריט, כרזה או מחירון מעוצב בסוכן המעצב הגרפי."
            action={
              <Button
                icon="plus"
                onClick={() =>
                  navigate(`/app/businesses/${businessId}/agents/designer`)
                }
              >
                לסוכן המעצב
              </Button>
            }
          />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="divide-y divide-navy-50 overflow-hidden">
          {list.map((d) => (
            <DesignRow key={d.id} design={d} businessId={businessId} />
          ))}
        </Card>
      )}
    </>
  );
}

function DesignRow({
  design,
  businessId,
}: {
  design: DesignProduct;
  businessId: string;
}) {
  return (
    <a
      href={designerApi.pdfUrl(businessId, design.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 group"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <Icon name="palette" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-navy-800 group-hover:text-brand-700">
          {design.title}
        </div>
        <div className="text-xs text-navy-400">
          {DESIGN_KIND_LABEL[design.kind]} · PDF
        </div>
      </div>
      <Icon
        name="external"
        size={16}
        className="shrink-0 text-navy-300 group-hover:text-brand-600"
      />
    </a>
  );
}
