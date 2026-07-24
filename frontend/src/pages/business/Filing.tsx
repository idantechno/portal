import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../api/client";
import { type FiledDocument, filingApi } from "../../api/filing";
import { Card, FormError, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Filing() {
  const { businessId = "" } = useParams<{ businessId: string }>();
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
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">מסמכים</h1>
        <p className="text-navy-500 text-sm">
          פשוט זרוק כאן את המסמכים של העסק — ביטוח לאומי, חשבונות, מס הכנסה. הכל
          מסודר בתיקיות, ומסמכים שהסוכן מפיק נכנסים לכאן אוטומטית.
        </p>
      </header>

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

      {files.isLoading && <div className="text-navy-400 text-sm">טוען...</div>}
      {!files.isLoading && all.length === 0 && (
        <Card className="p-10 text-center text-navy-400">
          עדיין אין מסמכים. גרור את הראשון למעלה.
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
    </div>
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
      <select
        value={doc.folder}
        onChange={(e) => onMove(e.target.value)}
        className="text-xs rounded-md border border-navy-200 bg-white px-2 py-1 text-navy-600 shrink-0 max-w-[100px] sm:max-w-none"
        title="העבר לתיקייה"
      >
        {folders.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
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
