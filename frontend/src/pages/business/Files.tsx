import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "../../api/files";
import { apiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/auth";
import {
  Button,
  Card,
  FormError,
  Input,
  Spinner,
} from "../../components/ui";
import { renderMarkdown } from "../../components/markdown";
import type { ContextFile, ContextFileTree } from "../../api/types";

const TEXT_EXTENSIONS = new Set([
  "md", "markdown", "txt", "csv", "json", "yaml", "yml",
  "html", "htm", "css", "js", "ts", "tsx", "jsx", "xml", "log", "sql",
]);

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

function isTextFile(file: { relativePath: string; mimeType: string }): boolean {
  if (file.mimeType.startsWith("text/")) return true;
  if (file.mimeType === "application/json") return true;
  return TEXT_EXTENSIONS.has(ext(file.relativePath));
}

function isMarkdownFile(file: { relativePath: string }): boolean {
  return MARKDOWN_EXTENSIONS.has(ext(file.relativePath));
}

function formatBytes(sizeStr: string): string {
  const n = Number(sizeStr);
  if (!Number.isFinite(n)) return sizeStr;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

interface ExplorerEntry {
  type: "folder" | "file";
  name: string;
  path: string;
  hiddenForBusiness: boolean;
  file?: ContextFile;
}

function entriesAt(tree: ContextFileTree, folder: string): ExplorerEntry[] {
  const subfolders = new Map<string, boolean>();
  for (const folderPath of tree.folders) {
    if (folder === "" ? !folderPath.includes("/") : folderPath.startsWith(folder + "/")) {
      const rest = folder === "" ? folderPath : folderPath.slice(folder.length + 1);
      const name = rest.split("/")[0];
      const fullChildPath = joinPath(folder, name);
      const hidden = fullChildPath === "_hidden" || fullChildPath.startsWith("_hidden/");
      const existing = subfolders.get(name);
      subfolders.set(name, existing ?? hidden);
    }
  }
  const folderEntries: ExplorerEntry[] = Array.from(subfolders.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, hidden]) => ({
      type: "folder" as const,
      name,
      path: joinPath(folder, name),
      hiddenForBusiness: hidden,
    }));

  const fileEntries: ExplorerEntry[] = tree.files
    .filter((f) => dirname(f.relativePath) === folder)
    .sort((a, b) => basename(a.relativePath).localeCompare(basename(b.relativePath)))
    .map((f) => ({
      type: "file" as const,
      name: basename(f.relativePath),
      path: f.relativePath,
      hiddenForBusiness: f.hiddenForBusiness,
      file: f,
    }));

  return [...folderEntries, ...fileEntries];
}

export default function Files() {
  const { t } = useTranslation();
  const { businessId = "" } = useParams<{ businessId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const path = searchParams.get("path") ?? "";
  const fileId = searchParams.get("file");

  const tree = useQuery({
    queryKey: ["files-tree", businessId],
    queryFn: () => filesApi.tree(businessId),
    enabled: Boolean(businessId),
  });

  if (fileId) {
    return (
      <FileEditor
        businessId={businessId}
        fileId={fileId}
        onClose={() => {
          searchParams.delete("file");
          setSearchParams(searchParams, { replace: true });
        }}
      />
    );
  }

  return (
    <Explorer
      businessId={businessId}
      path={path}
      tree={tree.data}
      loading={tree.isLoading}
      onNavigate={(next) => {
        if (next) searchParams.set("path", next);
        else searchParams.delete("path");
        setSearchParams(searchParams, { replace: true });
      }}
      onOpenFile={(id) => {
        searchParams.set("file", id);
        setSearchParams(searchParams);
      }}
    />
  );

  // unreachable, just for t() inference
  void t;
}

interface ExplorerProps {
  businessId: string;
  path: string;
  tree: ContextFileTree | undefined;
  loading: boolean;
  onNavigate: (path: string) => void;
  onOpenFile: (id: string) => void;
}

function Explorer({
  businessId,
  path,
  tree,
  loading,
  onNavigate,
  onOpenFile,
}: ExplorerProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isGlobalAdmin = user?.role === "global_admin";
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadHidden, setUploadHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  const isHiddenContext =
    path === "_hidden" || path.startsWith("_hidden/");

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      filesApi.upload(businessId, file, {
        hidden: uploadHidden || isHiddenContext,
        folder: path,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] }),
    onError: (err) => setError(apiErrorMessage(err, t("files.uploadFailed"))),
  });

  const deleteMut = useMutation({
    mutationFn: (fid: string) => filesApi.delete(businessId, fid),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] }),
    onError: (err) => setError(apiErrorMessage(err, t("files.deleteFailed"))),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, newPath }: { id: string; newPath: string }) =>
      filesApi.move(businessId, id, newPath),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] }),
    onError: (err) => setError(apiErrorMessage(err, t("files.renameFailed"))),
  });

  const createFolderMut = useMutation({
    mutationFn: ({ folderPath, hidden }: { folderPath: string; hidden: boolean }) =>
      filesApi.createFolder(businessId, folderPath, { hidden }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] }),
    onError: (err) =>
      setError(apiErrorMessage(err, t("files.createFolderFailed"))),
  });

  const createFileMut = useMutation({
    mutationFn: (input: {
      filename: string;
      hidden: boolean;
    }) =>
      filesApi.createTextFile(businessId, {
        path: joinPath(path, input.filename),
        content: input.filename.toLowerCase().endsWith(".md")
          ? `# ${input.filename.replace(/\.md$/i, "")}\n\n`
          : "",
        hidden: input.hidden,
      }),
    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] });
      onOpenFile(file.id);
    },
    onError: (err) => setError(apiErrorMessage(err, t("files.createFileFailed"))),
  });

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadMut.mutate(file);
    e.target.value = "";
  }

  function onDeleteFile(file: ContextFile) {
    if (!confirm(t("files.deleteConfirm", { name: basename(file.relativePath) })))
      return;
    deleteMut.mutate(file.id);
  }

  function onRenameFile(file: ContextFile) {
    const current = basename(file.relativePath);
    const next = prompt(t("files.renamePrompt"), current);
    if (!next || next === current) return;
    if (next.includes("/")) {
      setError(t("files.renameNoSlashes"));
      return;
    }
    const dest = joinPath(dirname(file.relativePath), next);
    renameMut.mutate({ id: file.id, newPath: dest });
  }

  const entries = useMemo(
    () => (tree ? entriesAt(tree, path) : []),
    [tree, path],
  );

  const breadcrumbs = useMemo(() => {
    const segs = path ? path.split("/") : [];
    const acc: { label: string; path: string }[] = [
      { label: t("files.root"), path: "" },
    ];
    let cur = "";
    for (const s of segs) {
      cur = cur ? `${cur}/${s}` : s;
      acc.push({ label: s, path: cur });
    }
    return acc;
  }, [path, t]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">{t("files.title")}</h1>
        <p className="text-neutral-600 text-sm">{t("files.subtitle")}</p>
      </header>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <nav className="flex items-center gap-1 text-sm flex-wrap min-w-0" dir="ltr">
            {breadcrumbs.map((bc, i) => (
              <span key={bc.path} className="flex items-center gap-1">
                {i > 0 && <span className="text-neutral-400">/</span>}
                <button
                  onClick={() => onNavigate(bc.path)}
                  className={
                    i === breadcrumbs.length - 1
                      ? "font-medium text-neutral-900 truncate max-w-[200px]"
                      : "text-brand-600 hover:underline truncate max-w-[200px]"
                  }
                  title={bc.path || "/"}
                >
                  {i === 0 ? bc.label : basename(bc.path)}
                </button>
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-2 flex-wrap">
            {isGlobalAdmin && !isHiddenContext && (
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={uploadHidden}
                  onChange={(e) => setUploadHidden(e.target.checked)}
                />
                {t("files.uploadHidden")}
              </label>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFolder(true)}
            >
              {t("files.newFolder")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFile(true)}
            >
              {t("files.newFile")}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={onPick}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMut.isPending}
            >
              {uploadMut.isPending ? (
                <>
                  <Spinner /> {t("files.uploading")}
                </>
              ) : (
                t("files.upload")
              )}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3">
            <FormError message={error} />
          </div>
        )}
      </Card>

      {showNewFolder && (
        <NewItemDialog
          title={t("files.newFolder")}
          label={t("files.folderName")}
          placeholder={t("files.folderNamePlaceholder")}
          allowHidden={isGlobalAdmin && !isHiddenContext}
          onCancel={() => setShowNewFolder(false)}
          onSubmit={(name, hidden) => {
            setShowNewFolder(false);
            const folderPath = joinPath(path, name);
            createFolderMut.mutate({
              folderPath,
              hidden: hidden || isHiddenContext,
            });
          }}
        />
      )}

      {showNewFile && (
        <NewItemDialog
          title={t("files.newFile")}
          label={t("files.fileName")}
          placeholder={t("files.fileNamePlaceholder")}
          allowHidden={isGlobalAdmin && !isHiddenContext}
          onCancel={() => setShowNewFile(false)}
          onSubmit={(name, hidden) => {
            setShowNewFile(false);
            createFileMut.mutate({
              filename: name,
              hidden: hidden || isHiddenContext,
            });
          }}
        />
      )}

      {loading && (
        <div className="text-neutral-500 text-sm">{t("common.loading")}</div>
      )}

      {!loading && entries.length === 0 && (
        <Card className="p-12 text-center text-neutral-500">
          {path ? t("files.emptyFolder") : t("files.noFiles")}
        </Card>
      )}

      {entries.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-start px-4 py-3 w-[60%]">
                  {t("files.name")}
                </th>
                <th className="text-start px-4 py-3">{t("files.size")}</th>
                <th className="text-start px-4 py-3">
                  {t("files.uploadedAt")}
                </th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map((entry) =>
                entry.type === "folder" ? (
                  <tr
                    key={`f:${entry.path}`}
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => onNavigate(entry.path)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <FolderIcon />
                        <span className="font-medium" dir="ltr">
                          {entry.name}
                        </span>
                        {entry.hiddenForBusiness && (
                          <span className="inline-block rounded bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5">
                            {t("files.hidden")}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">—</td>
                    <td className="px-4 py-3 text-neutral-400">—</td>
                    <td className="px-4 py-3 text-end"></td>
                  </tr>
                ) : (
                  <tr key={entry.file!.id} className="hover:bg-neutral-50">
                    <td
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => onOpenFile(entry.file!.id)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <FileIcon
                          markdown={isMarkdownFile(entry.file!)}
                          text={isTextFile(entry.file!)}
                        />
                        <span dir="ltr" className="font-mono text-xs">
                          {entry.name}
                        </span>
                        {entry.hiddenForBusiness && (
                          <span className="inline-block rounded bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 font-sans">
                            {t("files.hidden")}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatBytes(entry.file!.size)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600" dir="ltr">
                      {new Date(entry.file!.createdAt).toLocaleString(
                        i18n.language === "he" ? "he-IL" : "en-US",
                      )}
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <button
                        onClick={() => onRenameFile(entry.file!)}
                        className="text-neutral-600 hover:underline text-xs me-3"
                      >
                        {t("files.rename")}
                      </button>
                      <button
                        onClick={() => onDeleteFile(entry.file!)}
                        className="text-red-600 hover:underline text-xs"
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

interface NewItemDialogProps {
  title: string;
  label: string;
  placeholder: string;
  allowHidden: boolean;
  onCancel: () => void;
  onSubmit: (name: string, hidden: boolean) => void;
}

function NewItemDialog({
  title,
  label,
  placeholder,
  allowHidden,
  onCancel,
  onSubmit,
}: NewItemDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [hidden, setHidden] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function trySubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.includes("/") || trimmed.includes("\\")) return;
    onSubmit(trimmed, hidden);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <Card
        className="p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
          </label>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === "Enter") trySubmit();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
        {allowHidden && (
          <label className="flex items-center gap-2 text-sm text-neutral-700 mb-4">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
            />
            {t("files.uploadHidden")}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={trySubmit} disabled={!name.trim()}>
            {t("files.create")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

interface FileEditorProps {
  businessId: string;
  fileId: string;
  onClose: () => void;
}

function FileEditor({ businessId, fileId, onClose }: FileEditorProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileQ = useQuery({
    queryKey: ["file-content", businessId, fileId],
    queryFn: () => filesApi.getContent(businessId, fileId),
  });

  useEffect(() => {
    if (fileQ.data) {
      setContent(fileQ.data.content);
      setOriginal(fileQ.data.content);
    }
  }, [fileQ.data]);

  const saveMut = useMutation({
    mutationFn: () => filesApi.updateContent(businessId, fileId, content),
    onSuccess: () => {
      setOriginal(content);
      qc.invalidateQueries({ queryKey: ["files-tree", businessId] });
      qc.invalidateQueries({ queryKey: ["file-content", businessId, fileId] });
    },
    onError: (err) => setError(apiErrorMessage(err, t("files.saveFailed"))),
  });

  const file = fileQ.data?.file;
  const isText = file ? isTextFile(file) : false;
  const isMd = file ? isMarkdownFile(file) : false;
  const dirty = content !== original;

  if (fileQ.isLoading) {
    return (
      <div className="p-8 text-neutral-500 text-sm">{t("common.loading")}</div>
    );
  }

  if (fileQ.isError || !file) {
    return (
      <div className="p-8">
        <Button variant="secondary" onClick={onClose}>
          {t("common.back")}
        </Button>
        <div className="mt-4">
          <FormError
            message={apiErrorMessage(fileQ.error, t("files.loadFailed"))}
          />
        </div>
      </div>
    );
  }

  if (!isText) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="secondary" onClick={onClose}>
          {t("common.back")}
        </Button>
        <Card className="mt-4 p-8 text-center">
          <FileIcon markdown={false} text={false} />
          <p className="mt-3 font-mono text-sm" dir="ltr">
            {file.relativePath}
          </p>
          <p className="mt-1 text-neutral-500 text-sm">
            {file.mimeType} · {formatBytes(file.size)}
          </p>
          <p className="mt-4 text-neutral-600 text-sm">
            {t("files.notEditable")}
          </p>
          <div className="mt-6">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const blob = await filesApi.downloadBlob(businessId, fileId);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = basename(file.relativePath);
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(apiErrorMessage(err, t("files.downloadFailed")));
                }
              }}
            >
              {t("files.download")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose}>
            ← {t("common.back")}
          </Button>
          <span
            className="font-mono text-sm text-neutral-700 truncate"
            dir="ltr"
            title={file.relativePath}
          >
            {file.relativePath}
          </span>
          {dirty && (
            <span className="text-amber-600 text-xs">
              {t("files.unsaved")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMd && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? t("files.hidePreview") : t("files.showPreview")}
            </Button>
          )}
          <Button
            size="sm"
            disabled={!dirty || saveMut.isPending}
            onClick={() => {
              setError(null);
              saveMut.mutate();
            }}
          >
            {saveMut.isPending ? (
              <>
                <Spinner /> {t("files.saving")}
              </>
            ) : (
              t("files.save")
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3">
          <FormError message={error} />
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        <Card className="overflow-hidden flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-4 font-mono text-sm bg-white outline-none resize-none"
            dir="auto"
          />
        </Card>
        {isMd && showPreview && (
          <Card className="overflow-auto p-6">
            <article
              className="markdown-preview"
              dir="auto"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </Card>
        )}
        {!isMd && (
          <Card className="overflow-auto p-4 hidden lg:block">
            <div className="text-xs text-neutral-500 mb-2">
              {t("files.fileInfo")}
            </div>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t("files.size")}</dt>
                <dd>{formatBytes(file.size)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t("files.mimeType")}</dt>
                <dd className="font-mono text-xs">{file.mimeType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t("files.uploadedAt")}</dt>
                <dd>{new Date(file.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-amber-500 shrink-0"
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function FileIcon({
  markdown,
  text,
}: {
  markdown: boolean;
  text: boolean;
}) {
  const color = markdown
    ? "text-brand-500"
    : text
      ? "text-neutral-500"
      : "text-neutral-400";
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`${color} shrink-0`}
      aria-hidden
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}
