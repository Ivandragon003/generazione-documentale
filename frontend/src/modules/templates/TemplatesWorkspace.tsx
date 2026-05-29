import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
} from "@mui/material";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HeaderBar } from "../../components/HeaderBar";
import { PdfPreview } from "../../components/PdfPreview";
import { TemplateEditor } from "../../components/TemplateEditor";
import {
  type AiSemanticWarningDto,
  ApiRequestError,
  type ApiTemplateField,
  type AuditLogDto,
  auditTemplateMarkdown,
  createTemplate,
  type DeterministicValidationIssueDto,
  deleteTemplate,
  type FieldValue,
  type FieldValueMap,
  generateDocxBlob,
  generateTemplateDraft,
  getPdfJob,
  getPdfJobs,
  getTemplateContent,
  getTemplates,
  getTemplateTreeLevel,
  getTemplateVersionContent,
  getTenantAuditLogs,
  getTenants,
  listTemplateVersions,
  type PdfJobDto,
  repairTemplateDraft,
  restoreTemplateVersion,
  searchTemplatesLazy,
  type TemplateDraftGenerationReportDto,
  type TemplateDto,
  type TemplateVersionDto,
  type TenantDto,
  triggerPdfGeneration,
  updateTemplate,
  validateTemplateMarkdown,
} from "../../data/api";
import {
  analyzeLivePlaceholderIssues,
  type LivePlaceholderIssue,
} from "../../utils/livePlaceholderDiagnostics";
import {
  extractPlaceholders,
  initialFieldValues,
  mergeFieldValues,
  normalizeFieldDefinitions,
  stableStringify,
  validateFieldValues,
} from "../../utils/template";
import { CreateTemplateDialog } from "./components/CreateTemplateDialog";
import { DeleteTemplateDialog } from "./components/DeleteTemplateDialog";
import {
  type LazyTreeNode,
  ProjectStructure,
} from "./components/ProjectStructure";
import { TemplateAuditDrawer } from "./components/TemplateAuditDrawer";
import { TemplateDraftGeneratorPanel } from "./components/TemplateDraftGeneratorPanel";
import { TemplateVersionsDrawer } from "./components/TemplateVersionsDrawer";

const tabLabels = ["Template", "Document"];

type AppStatus = "loading" | "ready" | "saving" | "error";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

async function withBootRetry<T>(load: () => Promise<T>): Promise<T> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await load();
    } catch {
      if (attempt === maxAttempts) throw new Error("Backend unavailable");
      await sleep(800);
    }
  }
  throw new Error("Backend unavailable");
}

async function pollJobUntilDone(
  templateId: string,
  jobId: string,
  tenantUuid: string,
  onUpdate: (job: PdfJobDto) => void,
): Promise<void> {
  const maxAttempts = 24;
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs);
    try {
      const updated = await getPdfJob(templateId, jobId, tenantUuid);
      onUpdate(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        return;
      }
    } catch (error) {
      console.warn("PDF job polling failed, retrying on next tick", {
        templateId,
        jobId,
        error,
      });
    }
  }
}

function toPathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-");
}

export function TemplatesWorkspace() {
  const liveValidationDebounceMsRaw = Number.parseInt(
    import.meta.env.VITE_EDITOR_VALIDATE_DEBOUNCE_MS ?? "350",
    10,
  );
  const liveValidationDebounceMs = Number.isFinite(liveValidationDebounceMsRaw)
    ? Math.min(Math.max(liveValidationDebounceMsRaw, 100), 2000)
    : 350;
  const searchDebounceMsRaw = Number.parseInt(
    import.meta.env.VITE_TEMPLATE_SEARCH_DEBOUNCE_MS ?? "80",
    10,
  );
  const searchDebounceMs = Number.isFinite(searchDebounceMsRaw)
    ? Math.min(Math.max(searchDebounceMsRaw, 50), 1000)
    : 80;
  const [activeTab, setActiveTab] = useState(0);
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error";
  }>({ open: false, msg: "", severity: "success" });

  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [selectedTenantUuid, setSelectedTenantUuid] = useState<string>("");
  const [, setTemplates] = useState<TemplateDto[]>([]);
  const [rootNodes, setRootNodes] = useState<LazyTreeNode[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<
    Record<string, LazyTreeNode[]>
  >({});
  const [loadingPaths, setLoadingPaths] = useState<Record<string, boolean>>({});
  const [searchResults, setSearchResults] = useState<
    { type: "template"; name: string; path: string; id: string }[]
  >([]);
  const [markdown, setMarkdown] = useState("");
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({});
  const [initialDocumentValues, setInitialDocumentValues] =
    useState<FieldValueMap>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [templateValidationIssues, setTemplateValidationIssues] = useState<
    LivePlaceholderIssue[]
  >([]);
  const [aiWarnings, setAiWarnings] = useState<AiSemanticWarningDto[]>([]);
  const [aiMeta, setAiMeta] = useState<{
    provider: string;
    model: string | null;
    latencyMs: number;
  } | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("it");
  const [draftRunSemanticAudit, setDraftRunSemanticAudit] = useState(false);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftResult, setDraftResult] =
    useState<TemplateDraftGenerationReportDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [createMode, setCreateMode] = useState<"create" | "import">("create");
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditLogDto[]>([]);
  const [versionsTemplate, setVersionsTemplate] = useState<TemplateDto | null>(
    null,
  );
  const [templateVersions, setTemplateVersions] = useState<
    TemplateVersionDto[]
  >([]);
  const [selectedVersionSha, setSelectedVersionSha] = useState<string | null>(
    null,
  );
  const [versionPreviewBaseMarkdown, setVersionPreviewBaseMarkdown] = useState<
    string | null
  >(null);
  const [restoreTarget, setRestoreTarget] = useState<TemplateVersionDto | null>(
    null,
  );
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const lastSearchQueryRef = useRef("");
  const lastSearchTenantRef = useRef("");
  const lastSearchResultsRef = useRef<
    { type: "template"; name: string; path: string; id: string }[]
  >([]);
  const liveValidationDebounceRef = useRef<number | null>(null);
  const liveValidationSeqRef = useRef(0);
  const lastValidationRef = useRef<{ content: string; valid: boolean } | null>(
    null,
  );
  const inFlightValidationRef = useRef<{
    content: string;
    promise: Promise<boolean>;
  } | null>(null);
  const searchCacheRef = useRef<
    Record<
      string,
      { items: { type: "template"; name: string; path: string; id: string }[] }
    >
  >({});
  const searchRequestSeqRef = useRef(0);
  const templateContentCacheRef = useRef<Record<string, TemplateDto>>({});
  const templateVersionsCache = useRef<Record<string, TemplateVersionDto[]>>(
    {},
  );
  const versionContentCache = useRef<Record<string, string>>({});

  const originalPlaceholders = useRef<string[]>([]);
  const pollingAbort = useRef<AbortController | null>(null);

  const hasUnsavedChanges = markdown !== (template?.content ?? "");
  const hasDocumentValueChanges =
    stableStringify(fieldValues) !== stableStringify(initialDocumentValues);
  const showTypeHints = import.meta.env.DEV;

  const visibleFields = useMemo(
    () => normalizeFieldDefinitions(markdown, template?.fields ?? []),
    [markdown, template],
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const tenantsResponse = await withBootRetry(() => getTenants());
        if (cancelled) return;
        setTenants(tenantsResponse);
        const initialTenant = tenantsResponse[0]?.uuid ?? "";
        setSelectedTenantUuid(initialTenant);

        const tree = initialTenant
          ? await getTemplateTreeLevel(initialTenant)
          : null;
        if (!cancelled)
          setRootNodes([...(tree?.folders ?? []), ...(tree?.templates ?? [])]);

        setAppStatus("ready");
      } catch {
        if (!cancelled) {
          setAppStatus("error");
          setSnack({
            open: true,
            msg: "Unable to connect to backend.",
            severity: "error",
          });
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTemplate = useCallback((nextTemplate: TemplateDto) => {
    const fields = normalizeFieldDefinitions(
      nextTemplate.content,
      nextTemplate.fields,
    );
    setTemplate(nextTemplate);
    setMarkdown(nextTemplate.content);
    const defaults = initialFieldValues(fields);
    setFieldValues(defaults);
    setInitialDocumentValues(defaults);
    setFieldErrors({});
    setPdfJobs([]);
    setAiWarnings([]);
    setAiMeta(null);
    setDraftResult(null);
    originalPlaceholders.current = extractPlaceholders(nextTemplate.content);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    if (!template) {
      const msg =
        "No template selected. Use 'Create template' to choose where to save.";
      setSnack({ open: true, msg, severity: "error" });
      throw new Error(msg);
    }
    if (!markdown.trim()) {
      const msg = "Template content is empty.";
      setSnack({ open: true, msg, severity: "error" });
      throw new Error(msg);
    }

    setAppStatus("saving");
    try {
      const liveIssues = analyzeLivePlaceholderIssues(markdown);
      if (liveIssues.length > 0) {
        const msg = `Markdown validation failed: ${liveIssues
          .map((item) => item.message)
          .join("; ")}`;
        setTemplateValidationIssues(liveIssues);
        setSnack({ open: true, msg, severity: "error" });
        throw new Error(msg);
      }

      const validation = await validateTemplateMarkdown(markdown);
      if (!validation.valid) {
        const detailedIssues = mapBackendValidationIssues(
          markdown,
          validation.deterministic?.errors,
          validation.errors,
        );
        const msg = `Markdown validation failed: ${detailedIssues
          .map((item) => item.message)
          .join("; ")}`;
        setTemplateValidationIssues(detailedIssues);
        setSnack({ open: true, msg, severity: "error" });
        throw new Error(msg);
      }
      setTemplateValidationIssues([]);

      const fields: ApiTemplateField[] = visibleFields.map(
        ({
          name,
          label,
          type,
          required,
          maxLength,
          defaultValue,
          placeholder,
          listName,
          options,
          columns,
        }) => ({
          name,
          label,
          type,
          required,
          maxLength,
          defaultValue,
          placeholder,
          listName,
          options,
          columns,
        }),
      );
      const saved = await updateTemplate(template.id, {
        content: markdown,
        fields,
        tenantUuid: selectedTenantUuid,
      });

      originalPlaceholders.current = extractPlaceholders(saved.content);
      setTemplate(saved);
      setTemplates((current) => [
        saved,
        ...current.filter(
          (item) => item.id !== template?.id && item.id !== saved.id,
        ),
      ]);
      const nextDefaults = initialFieldValues(
        normalizeFieldDefinitions(saved.content, saved.fields),
      );
      setFieldValues((current) => mergeFieldValues(current, nextDefaults));
      setSnack({ open: true, msg: "Template saved.", severity: "success" });
      return saved;
    } catch (err) {
      setSnack({
        open: true,
        msg: friendlyErrorMessage(err, "Failed to save template."),
        severity: "error",
      });
      throw err;
    } finally {
      setAppStatus("ready");
    }
  }, [markdown, selectedTenantUuid, template, visibleFields]);

  const handleSelectTenant = useCallback(async (tenantUuid: string) => {
    setSelectedTenantUuid(tenantUuid);
    const tree = await getTemplateTreeLevel(tenantUuid);
    setRootNodes([...(tree.folders ?? []), ...(tree.templates ?? [])]);
    setChildrenByPath({});
    setTemplates([]);
    setTemplate(null);
    setMarkdown("");
    setFieldValues({});
    setInitialDocumentValues({});
    setPdfJobs([]);
    setTemplateValidationIssues([]);
    setDraftResult(null);
    searchCacheRef.current = {};
    templateContentCacheRef.current = {};
  }, []);

  const handleFieldChange = useCallback((key: string, value: FieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const notifyError = useCallback((msg: string) => {
    setSnack({ open: true, msg, severity: "error" });
  }, []);

  const notifySuccess = useCallback((msg: string) => {
    setSnack({ open: true, msg, severity: "success" });
  }, []);

  const validateEditorContent = useCallback(
    async (content: string): Promise<boolean> => {
      const inFlight = inFlightValidationRef.current;
      if (inFlight && inFlight.content === content) {
        return inFlight.promise;
      }

      const seq = liveValidationSeqRef.current + 1;
      liveValidationSeqRef.current = seq;
      const validationPromise = (async () => {
        try {
          // Always recompute diagnostics from scratch for each validation run.
          setTemplateValidationIssues([]);
          const validation = await validateTemplateMarkdown(content);
          if (liveValidationSeqRef.current !== seq) return false;
          const backendIssues = mapBackendValidationIssues(
            content,
            validation.deterministic?.errors,
            validation.errors,
          );
          const liveIssues = analyzeLivePlaceholderIssues(content);
          const mergedIssues = mergeValidationIssues(liveIssues, backendIssues);
          if (!validation.valid) {
            setTemplateValidationIssues(mergedIssues);
            lastValidationRef.current = { content, valid: false };
            return false;
          }
          setTemplateValidationIssues([]);
          lastValidationRef.current = { content, valid: true };
          return true;
        } catch {
          if (liveValidationSeqRef.current === seq) {
            setTemplateValidationIssues([]);
          }
          lastValidationRef.current = null;
          return false;
        } finally {
          if (inFlightValidationRef.current?.content === content) {
            inFlightValidationRef.current = null;
          }
        }
      })();

      inFlightValidationRef.current = {
        content,
        promise: validationPromise,
      };
      return validationPromise;
    },
    [],
  );

  const handleRunAiReview = useCallback(async () => {
    setAiReviewLoading(true);
    try {
      const report = await auditTemplateMarkdown(markdown, true);
      setAiWarnings(report.ai?.warnings ?? []);
      if (report.ai) {
        setAiMeta({
          provider: report.ai.provider,
          model: report.ai.model,
          latencyMs: report.ai.latencyMs,
        });
      } else {
        setAiMeta(null);
      }
      if (report.ai?.failed) {
        if ((report.ai.error ?? "").toLowerCase().includes("skipped")) {
          notifySuccess(report.ai.error ?? "AI semantic review skipped.");
        } else {
          notifyError(
            `AI review unavailable: ${report.ai.error ?? "unknown error"}`,
          );
        }
      } else {
        notifySuccess("AI review completed.");
      }
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "AI review failed."));
    } finally {
      setAiReviewLoading(false);
    }
  }, [markdown, notifyError, notifySuccess]);

  const handleGenerateDraft = useCallback(async () => {
    const description = draftDescription.trim();
    if (!description) {
      notifyError("Insert a document description before generating.");
      return;
    }
    setDraftGenerating(true);
    try {
      const report = await generateTemplateDraft({
        description,
        language: draftLanguage,
        runSemanticAudit: draftRunSemanticAudit,
      });
      setDraftResult(report);
      notifySuccess("Draft generated.");
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "Draft generation failed."));
    } finally {
      setDraftGenerating(false);
    }
  }, [
    draftDescription,
    draftLanguage,
    draftRunSemanticAudit,
    notifyError,
    notifySuccess,
  ]);

  const handleApplyDraft = useCallback(async () => {
    if (!draftResult) return;
    const nextContent = draftResult.content ?? "";
    if (!nextContent.trim()) {
      notifyError("Draft vuoto: impossibile caricarlo nell'editor.");
      return;
    }
    setMarkdown(nextContent);
    await validateEditorContent(nextContent);
    setDraftResult(null);
    notifySuccess("Draft loaded in editor.");
  }, [draftResult, notifyError, notifySuccess, validateEditorContent]);

  const applySafeCorrectionToContent = useCallback(
    async (sourceMarkdown: string, source: "editor" | "draft") => {
      if (!sourceMarkdown.trim()) {
        const label = source === "editor" ? "Editor" : "Draft";
        notifyError(`${label} vuoto: nessun contenuto da correggere.`);
        return;
      }
      try {
        const repaired = await repairTemplateDraft({
          content: sourceMarkdown,
          language: draftLanguage,
          runSemanticAudit: draftRunSemanticAudit,
          generationMode: "guided",
          defaultLength: 100,
        });
        const repairedMarkdown = repaired?.content;
        const hasValidRepairedMarkdown =
          typeof repairedMarkdown === "string" &&
          repairedMarkdown.trim().length > 0;
        const repairAppliedCount = repaired.repair?.repairAppliedCount ?? 0;

        if (!hasValidRepairedMarkdown) {
          notifyError("Nessuna correzione sicura applicata");
          return;
        }
        if (repairAppliedCount === 0) {
          notifyError("Nessuna correzione sicura applicata");
          return;
        }
        if (repairedMarkdown === sourceMarkdown) {
          notifyError("Nessuna correzione sicura applicata");
          return;
        }

        setMarkdown(repairedMarkdown);
        await validateEditorContent(repairedMarkdown);
        setAiWarnings(repaired.semanticAudit?.warnings ?? []);
        setAiMeta(repaired.ai ?? null);
        setDraftResult(repaired);

        if (repaired.repair?.finalValidationPassed) {
          notifySuccess("Template valido dopo correzione");
        } else {
          notifyError(
            `Correzioni applicate: ${repaired.repair?.repairAppliedCount ?? 0}. Errori rimanenti: ${repaired.repair?.errorsAfterRepair ?? repaired.deterministic.errors.length}`,
          );
        }
      } catch (error) {
        notifyError(friendlyErrorMessage(error, "Safe correction failed."));
      }
    },
    [
      draftLanguage,
      draftRunSemanticAudit,
      notifyError,
      notifySuccess,
      validateEditorContent,
    ],
  );

  const handleApplySafeCorrection = useCallback(async () => {
    const editorMarkdown = markdown;
    if (!editorMarkdown.trim()) {
      notifyError("Editor vuoto: nessun contenuto da correggere.");
      return;
    }
    await applySafeCorrectionToContent(editorMarkdown, "editor");
  }, [applySafeCorrectionToContent, markdown, notifyError]);

  const handleApplySafeCorrectionToDraft = useCallback(async () => {
    const draftMarkdown = draftResult?.content ?? "";
    if (!draftMarkdown.trim()) {
      notifyError("Draft vuoto: nessun contenuto da correggere.");
      return;
    }
    await applySafeCorrectionToContent(draftMarkdown, "draft");
  }, [applySafeCorrectionToContent, draftResult, notifyError]);

  const validateGenerationFields = useCallback((): boolean => {
    const errors = validateFieldValues(visibleFields, fieldValues);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActiveTab(1);
      notifyError("Complete required fields before generation.");
      return false;
    }
    return true;
  }, [fieldValues, notifyError, visibleFields]);

  const ensureSavedTemplateForGeneration = useCallback(async () => {
    let currentTemplate = template;
    if (!currentTemplate) {
      notifyError("Select a template before generation.");
      return null;
    }
    if (!hasUnsavedChanges) return currentTemplate;
    try {
      currentTemplate = await handleSaveTemplate();
      return currentTemplate;
    } catch {
      return null;
    }
  }, [handleSaveTemplate, hasUnsavedChanges, notifyError, template]);

  const applyPolledPdfJobUpdate = useCallback(
    (updated: PdfJobDto) => {
      setPdfJobs((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (updated.status === "completed") {
        notifySuccess("PDF generated successfully.");
        setActiveTab(1);
        return;
      }
      if (updated.status === "failed") {
        notifyError(
          `PDF generation failed: ${updated.errorMessage ?? "unknown error"}`,
        );
      }
    },
    [notifyError, notifySuccess],
  );

  const startPdfJobPolling = useCallback(
    (templateId: string, jobId: string, abort: AbortController) => {
      void pollJobUntilDone(
        templateId,
        jobId,
        selectedTenantUuid,
        (updated) => {
          if (abort.signal.aborted) return;
          applyPolledPdfJobUpdate(updated);
        },
      );
    },
    [applyPolledPdfJobUpdate, selectedTenantUuid],
  );

  const handleGeneratePdf = useCallback(async () => {
    const liveIssues = analyzeLivePlaceholderIssues(markdown);
    if (liveIssues.length > 0) {
      setTemplateValidationIssues(liveIssues);
      setActiveTab(0);
      notifyError("Fix template errors before generating.");
      return;
    }

    const currentTemplate = await ensureSavedTemplateForGeneration();
    if (!currentTemplate) return;
    if (!validateGenerationFields()) return;

    pollingAbort.current?.abort();
    const abort = new AbortController();
    pollingAbort.current = abort;

    try {
      const job = await triggerPdfGeneration(
        currentTemplate.id,
        fieldValues,
        selectedTenantUuid,
      );
      setPdfJobs((current) => [
        job,
        ...current.filter((item) => item.id !== job.id),
      ]);
      notifySuccess("PDF generation started.");

      startPdfJobPolling(currentTemplate.id, job.id, abort);
    } catch (err) {
      notifyError(friendlyErrorMessage(err, "PDF generation failed."));
    }
  }, [
    markdown,
    ensureSavedTemplateForGeneration,
    fieldValues,
    notifyError,
    notifySuccess,
    selectedTenantUuid,
    startPdfJobPolling,
    validateGenerationFields,
  ]);

  const handleGenerateDocx = useCallback(async () => {
    const currentTemplate = await ensureSavedTemplateForGeneration();
    if (!currentTemplate) return;
    if (!validateGenerationFields()) return;

    try {
      const blob = await generateDocxBlob(
        currentTemplate.id,
        fieldValues,
        selectedTenantUuid,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentTemplate.name || "document"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notifySuccess("DOCX generated.");
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "DOCX generation failed."));
    }
  }, [
    ensureSavedTemplateForGeneration,
    fieldValues,
    notifyError,
    notifySuccess,
    selectedTenantUuid,
    validateGenerationFields,
  ]);

  const refreshTemplatesAfterCreate = useCallback(
    async (createdId?: string) => {
      const templateResponse = await getTemplates(selectedTenantUuid);
      setTemplates(templateResponse.data);
      const created =
        templateResponse.data.find((item) => item.id === createdId) ??
        templateResponse.data[0] ??
        null;
      if (created) {
        applyTemplate(created);
        const jobs = await getPdfJobs(created.id, selectedTenantUuid).catch(
          () => [],
        );
        setPdfJobs(jobs);
      }
    },
    [applyTemplate, selectedTenantUuid],
  );

  const categoryOptions = useMemo(() => {
    const folders = rootNodes
      .filter(
        (node): node is { type: "folder"; name: string; path: string } =>
          node.type === "folder",
      )
      .map((node) => node.path.trim())
      .filter(Boolean);
    return Array.from(new Set(folders)).sort((a, b) => a.localeCompare(b));
  }, [rootNodes]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      setSelectedCategory("");
      return;
    }
    if (!categoryOptions.includes(selectedCategory)) {
      setSelectedCategory(categoryOptions[0]);
    }
  }, [categoryOptions, selectedCategory]);

  const handleCreateTemplate = useCallback(async () => {
    const name = newTemplateName.trim();
    const templateSegment = toPathSegment(name);
    if (!templateSegment) {
      notifyError("Template name contains no valid characters.");
      return;
    }
    const path = [selectedCategory.trim(), templateSegment]
      .filter(Boolean)
      .join("/");
    try {
      setAppStatus("saving");
      if (!name) {
        notifyError("Template name is required.");
        return;
      }
      if (!selectedCategory.trim()) {
        notifyError("Select a folder from GitHub.");
        return;
      }
      if (createMode === "import" && !pendingUploadFile) {
        notifyError("Select a .md file first.");
        return;
      }
      const content =
        createMode === "import"
          ? await pendingUploadFile?.text()
          : `# ${name}\n`;
      if (!content?.trim()) {
        notifyError("Template content is empty.");
        return;
      }
      const created = await createTemplate({
        name,
        content,
        path: path || undefined,
        tenantUuid: selectedTenantUuid,
      });
      await refreshTemplatesAfterCreate(created.id);
      setCreateOpen(false);
      setNewTemplateName("");
      setPendingUploadFile(null);
      notifySuccess("Template created.");
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "Failed to create template."));
    } finally {
      setAppStatus("ready");
    }
  }, [
    createMode,
    newTemplateName,
    notifyError,
    notifySuccess,
    pendingUploadFile,
    refreshTemplatesAfterCreate,
    selectedCategory,
    selectedTenantUuid,
  ]);

  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleUploadTemplateFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const isMd = /\.md$/i.test(file.name);
      if (!isMd) {
        notifyError("Only .md files are supported.");
        return;
      }
      setCreateMode("import");
      setPendingUploadFile(file);
      setNewTemplateName(file.name.replace(/\.md$/i, ""));
    },
    [notifyError],
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!template) return;
    try {
      setAppStatus("saving");
      await deleteTemplate(template.id, selectedTenantUuid);
      const templateResponse = await getTemplates(selectedTenantUuid);
      setTemplates(templateResponse.data);
      const next = templateResponse.data[0] ?? null;
      if (next) {
        applyTemplate(next);
        const jobs = await getPdfJobs(next.id, selectedTenantUuid).catch(
          () => [],
        );
        setPdfJobs(jobs);
      } else {
        setTemplate(null);
        setMarkdown("");
        setFieldValues({});
        setFieldErrors({});
        setPdfJobs([]);
      }
      setDeleteOpen(false);
      notifySuccess("Template deleted.");
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "Failed to delete template."));
    } finally {
      setAppStatus("ready");
    }
  }, [applyTemplate, notifyError, notifySuccess, selectedTenantUuid, template]);

  const openVersionsForTemplate = useCallback(
    async (selected: TemplateDto) => {
      if (!selectedTenantUuid) return;
      setVersionsTemplate(selected);
      setVersionsOpen(true);
      const cacheKey = `${selectedTenantUuid}:${selected.id}`;
      const cached = templateVersionsCache.current[cacheKey];
      const versions =
        cached ?? (await listTemplateVersions(selected.id, selectedTenantUuid));
      templateVersionsCache.current[cacheKey] = versions;
      setTemplateVersions(versions);
      setSelectedVersionSha(versions[0]?.sha ?? null);
    },
    [selectedTenantUuid],
  );

  const handleSelectVersion = useCallback(
    async (version: TemplateVersionDto) => {
      if (!versionsTemplate || !selectedTenantUuid) return;
      if (!versionPreviewBaseMarkdown) {
        setVersionPreviewBaseMarkdown(markdown);
      }
      const cacheKey = `${selectedTenantUuid}:${versionsTemplate.id}:${version.sha}`;
      const cached = versionContentCache.current[cacheKey];
      const response = cached
        ? { content: cached, commitSha: version.sha }
        : await getTemplateVersionContent(
            versionsTemplate.id,
            version.sha,
            selectedTenantUuid,
          );
      versionContentCache.current[cacheKey] = response.content;
      setSelectedVersionSha(version.sha);
      setMarkdown(response.content);
      setActiveTab(1);
    },
    [
      markdown,
      selectedTenantUuid,
      versionPreviewBaseMarkdown,
      versionsTemplate,
    ],
  );

  const handleConfirmRestore = useCallback(async () => {
    if (!versionsTemplate || !restoreTarget || !selectedTenantUuid) return;
    setIsRestoringVersion(true);
    try {
      await restoreTemplateVersion(
        versionsTemplate.id,
        restoreTarget.sha,
        selectedTenantUuid,
      );
      const refreshed = await getTemplates(selectedTenantUuid);
      setTemplates(refreshed.data);
      const current =
        refreshed.data.find((item) => item.id === versionsTemplate.id) ?? null;
      if (current) {
        applyTemplate(current);
        setTemplate(current);
      }
      const versions = await listTemplateVersions(
        versionsTemplate.id,
        selectedTenantUuid,
      );
      templateVersionsCache.current[
        `${selectedTenantUuid}:${versionsTemplate.id}`
      ] = versions;
      setTemplateVersions(versions);
      setSelectedVersionSha(versions[0]?.sha ?? null);
      setVersionPreviewBaseMarkdown(null);
      setRestoreTarget(null);
      notifySuccess("Version restored successfully.");
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "Version restore failed."));
    } finally {
      setIsRestoringVersion(false);
    }
  }, [
    applyTemplate,
    notifyError,
    notifySuccess,
    restoreTarget,
    selectedTenantUuid,
    versionsTemplate,
  ]);

  const handleExpandFolder = useCallback(
    async (path: string) => {
      if (!selectedTenantUuid) return;
      if (childrenByPath[path]) return;
      setLoadingPaths((current) => ({ ...current, [path]: true }));
      try {
        const tree = await getTemplateTreeLevel(selectedTenantUuid, path);
        setChildrenByPath((current) => ({
          ...current,
          [path]: [...tree.folders, ...tree.templates],
        }));
      } finally {
        setLoadingPaths((current) => ({ ...current, [path]: false }));
      }
    },
    [childrenByPath, selectedTenantUuid],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!selectedTenantUuid) return;
      const normalizedQuery = query.trim().toLowerCase();
      if (searchDebounceRef.current) {
        globalThis.clearTimeout(searchDebounceRef.current);
      }

      if (!normalizedQuery) {
        lastSearchQueryRef.current = "";
        lastSearchResultsRef.current = [];
        setSearchResults([]);
        return;
      }

      if (
        lastSearchTenantRef.current === selectedTenantUuid &&
        lastSearchQueryRef.current &&
        normalizedQuery.startsWith(lastSearchQueryRef.current) &&
        lastSearchResultsRef.current.length > 0
      ) {
        const filtered = lastSearchResultsRef.current.filter((item) => {
          const haystack = `${item.name} ${item.path}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        });
        setSearchResults(filtered);
      }

      searchDebounceRef.current = globalThis.setTimeout(async () => {
        const cacheKey = `${selectedTenantUuid}:${normalizedQuery}`;
        const cached = searchCacheRef.current[cacheKey];
        if (cached) {
          lastSearchTenantRef.current = selectedTenantUuid;
          lastSearchQueryRef.current = normalizedQuery;
          lastSearchResultsRef.current = cached.items;
          setSearchResults(cached.items);
          return;
        }

        const seq = searchRequestSeqRef.current + 1;
        searchRequestSeqRef.current = seq;
        try {
          const response = await searchTemplatesLazy(
            selectedTenantUuid,
            normalizedQuery,
          );
          if (searchRequestSeqRef.current !== seq) return;
          searchCacheRef.current[cacheKey] = { items: response.items };
          lastSearchTenantRef.current = selectedTenantUuid;
          lastSearchQueryRef.current = normalizedQuery;
          lastSearchResultsRef.current = response.items;
          setSearchResults(response.items);
        } catch {
          if (searchRequestSeqRef.current !== seq) return;
          setSearchResults([]);
          notifyError("Template search failed.");
        }
      }, searchDebounceMs);
    },
    [notifyError, searchDebounceMs, selectedTenantUuid],
  );

  const handleSelectTemplateLazy = useCallback(
    async (selected: TemplateDto) => {
      if (!selectedTenantUuid) return;
      const cacheKey = `${selectedTenantUuid}:${selected.id}`;
      const fullTemplate =
        templateContentCacheRef.current[cacheKey] ??
        (await getTemplateContent(selected.id, selectedTenantUuid));
      templateContentCacheRef.current[cacheKey] = fullTemplate;
      applyTemplate(fullTemplate);
      await validateEditorContent(fullTemplate.content);
      setTemplates((current) => {
        if (current.some((item) => item.id === fullTemplate.id)) return current;
        return [fullTemplate, ...current];
      });
      const jobs = await getPdfJobs(fullTemplate.id, selectedTenantUuid).catch(
        () => [],
      );
      setPdfJobs(jobs);
    },
    [applyTemplate, selectedTenantUuid, validateEditorContent],
  );

  const handleCloseVersions = useCallback(() => {
    setVersionsOpen(false);
    if (versionPreviewBaseMarkdown !== null) {
      setMarkdown(versionPreviewBaseMarkdown);
    }
    setVersionPreviewBaseMarkdown(null);
  }, [versionPreviewBaseMarkdown]);

  const handleOpenAudit = useCallback(async () => {
    if (!selectedTenantUuid || !template) {
      notifyError("Select a template before opening the audit trail.");
      return;
    }
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const events = await getTenantAuditLogs(
        selectedTenantUuid,
        template.id,
        120,
        0,
      );
      setAuditEvents(events);
    } catch (error) {
      notifyError(friendlyErrorMessage(error, "Failed to load audit events."));
    } finally {
      setAuditLoading(false);
    }
  }, [notifyError, selectedTenantUuid, template]);

  useEffect(() => {
    return () => {
      pollingAbort.current?.abort();
      if (searchDebounceRef.current) {
        globalThis.clearTimeout(searchDebounceRef.current);
      }
      if (liveValidationDebounceRef.current) {
        globalThis.clearTimeout(liveValidationDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!template || activeTab !== 0) return;
    if (liveValidationDebounceRef.current) {
      globalThis.clearTimeout(liveValidationDebounceRef.current);
    }

    liveValidationDebounceRef.current = globalThis.setTimeout(() => {
      void validateEditorContent(markdown);
    }, liveValidationDebounceMs);

    return () => {
      if (liveValidationDebounceRef.current) {
        globalThis.clearTimeout(liveValidationDebounceRef.current);
      }
    };
  }, [
    activeTab,
    liveValidationDebounceMs,
    markdown,
    template,
    validateEditorContent,
  ]);

  if (appStatus === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{ minHeight: "100vh", backgroundColor: "background.default", pb: 6 }}
    >
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        className="top-appbar"
      >
        <Container maxWidth="xl">
          <HeaderBar
            template={template}
            isSaving={appStatus === "saving"}
            onSave={handleSaveTemplate}
            onGeneratePdf={handleGeneratePdf}
            onGenerateDocx={handleGenerateDocx}
            onCreateTemplate={() => setCreateOpen(true)}
            onDeleteTemplate={() => setDeleteOpen(true)}
            onOpenVersions={() => {
              if (template) {
                void openVersionsForTemplate(template);
              }
            }}
            onOpenAudit={() => {
              void handleOpenAudit();
            }}
            pdfJobs={pdfJobs}
            canGeneratePdf={Boolean(template)}
            canSaveTemplate={Boolean(template)}
            showSaveTemplate={activeTab === 0}
            showPdfStatus={false}
            showGenerateActions
          />
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Box className="app-layout">
          <ProjectStructure
            tenants={tenants}
            selectedTenantUuid={selectedTenantUuid}
            onSelectTenant={handleSelectTenant}
            rootNodes={rootNodes}
            childrenByPath={childrenByPath}
            loadingPaths={loadingPaths}
            onExpandFolder={handleExpandFolder}
            onSearch={handleSearch}
            searchResults={searchResults}
            selectedTemplateId={template?.id ?? null}
            onSelectTemplate={handleSelectTemplateLazy}
            onOpenVersions={openVersionsForTemplate}
          />

          <Paper className="workspace-shell">
            <Tabs
              value={activeTab}
              onChange={(_, value: number) => setActiveTab(value)}
              className="workspace-tabs"
            >
              {tabLabels.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>

            <Box className="workspace-body">
              {!template && (
                <Paper className="preview-sheet">
                  <Alert severity="info" className="empty-state-alert">
                    Select a template from the project structure or create a new
                    template to get started.
                  </Alert>
                </Paper>
              )}

              {activeTab === 0 && template && (
                <Stack gap={2}>
                  <TemplateDraftGeneratorPanel
                    description={draftDescription}
                    language={draftLanguage}
                    runSemanticAudit={draftRunSemanticAudit}
                    isGenerating={draftGenerating}
                    result={draftResult}
                    onDescriptionChange={setDraftDescription}
                    onLanguageChange={setDraftLanguage}
                    onRunSemanticAuditChange={setDraftRunSemanticAudit}
                    onGenerate={handleGenerateDraft}
                    onApplyDraft={handleApplyDraft}
                    onApplySafeCorrectionToDraft={
                      handleApplySafeCorrectionToDraft
                    }
                  />
                  <TemplateEditor
                    markdown={markdown}
                    tenantUuid={selectedTenantUuid}
                    issues={templateValidationIssues}
                    pdfJobs={pdfJobs}
                    aiWarnings={aiWarnings}
                    aiMeta={aiMeta}
                    onRunAiReview={handleRunAiReview}
                    isAiReviewLoading={aiReviewLoading}
                    onApplySafeCorrection={handleApplySafeCorrection}
                    onChange={setMarkdown}
                  />
                </Stack>
              )}

              {activeTab === 1 && template && (
                <PdfPreview
                  markdown={markdown}
                  fields={visibleFields}
                  values={fieldValues}
                  errors={fieldErrors}
                  readOnly={false}
                  showTypeHints={showTypeHints}
                  onChange={handleFieldChange}
                  pdfJobs={pdfJobs}
                  templateId={template?.id}
                  documentName={template?.name}
                  templateContentHash={template?.contentHash}
                />
              )}
            </Box>
          </Paper>
        </Box>

        {appStatus === "error" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Backend unavailable. Make sure the server is running on{" "}
            <strong>localhost:3000</strong>.
          </Alert>
        )}

        {hasUnsavedChanges && appStatus === "ready" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            You have unsaved changes. Save the template before generating the
            PDF.
          </Alert>
        )}
        {!template && appStatus === "ready" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No template selected. To save, create a template and choose the
            destination folder/path.
          </Alert>
        )}
        {hasDocumentValueChanges && appStatus === "ready" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Document values modified and not persisted in any generated output
            yet.
          </Alert>
        )}
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      <CreateTemplateDialog
        open={createOpen}
        createMode={createMode}
        name={newTemplateName}
        selectedCategory={selectedCategory}
        categoryOptions={categoryOptions}
        pendingUploadFileName={pendingUploadFile?.name ?? null}
        onClose={() => setCreateOpen(false)}
        onModeChange={setCreateMode}
        onNameChange={setNewTemplateName}
        onCategoryChange={setSelectedCategory}
        onChooseFile={handleUploadClick}
        onConfirm={handleCreateTemplate}
      />

      <DeleteTemplateDialog
        open={deleteOpen}
        templateName={template?.name ?? "-"}
        saving={appStatus === "saving"}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteTemplate}
      />

      <TemplateVersionsDrawer
        open={versionsOpen}
        templateName={versionsTemplate?.name ?? "-"}
        versions={templateVersions}
        selectedSha={selectedVersionSha}
        onClose={handleCloseVersions}
        onSelectVersion={handleSelectVersion}
        onRestoreVersion={(version) => setRestoreTarget(version)}
      />

      <TemplateAuditDrawer
        open={auditOpen}
        loading={auditLoading}
        templateName={template?.name ?? "Template"}
        events={auditEvents}
        onClose={() => setAuditOpen(false)}
      />

      <Dialog
        open={Boolean(restoreTarget)}
        onClose={() => {
          if (!isRestoringVersion) setRestoreTarget(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm restore</DialogTitle>
        <DialogContent>
          Confirm restore of the selected version?
          {isRestoringVersion && (
            <Box
              sx={{
                mt: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                color: "text.secondary",
              }}
            >
              <CircularProgress size={16} />
              Restoring, please wait...
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRestoreTarget(null)}
            disabled={isRestoringVersion}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmRestore}
            disabled={isRestoringVersion}
            startIcon={
              isRestoringVersion ? (
                <CircularProgress size={15} color="inherit" />
              ) : undefined
            }
          >
            {isRestoringVersion ? "Restoring..." : "Restore"}
          </Button>
        </DialogActions>
      </Dialog>

      <input
        ref={uploadInputRef}
        type="file"
        accept=".md,.txt,text/markdown,text/plain"
        onChange={handleUploadTemplateFile}
        style={{ display: "none" }}
      />
    </Box>
  );
}

function indexToLineColumn(
  input: string,
  index: number,
): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, input.length));
  const lines = input.slice(0, safe).split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function findIssueColumn(
  content: string,
  line: number,
  placeholder?: string,
): number {
  if (!Number.isFinite(line) || line <= 0) return 1;
  const lines = content.split(/\r?\n/);
  const row = lines[line - 1] ?? "";
  if (!placeholder) return 1;
  const column = row.indexOf(placeholder);
  return column >= 0 ? column + 1 : 1;
}

function mapDeterministicIssue(
  content: string,
  issue: DeterministicValidationIssueDto,
): LivePlaceholderIssue {
  return {
    severity: issue.severity === "warning" ? "warning" : "error",
    line: issue.line > 0 ? issue.line : 1,
    column: findIssueColumn(content, issue.line, issue.placeholder),
    snippet: issue.placeholder ?? "",
    message: issue.message,
    suggestion: issue.suggestion,
  };
}

function mapBackendValidationIssues(
  content: string,
  deterministicErrors?: DeterministicValidationIssueDto[],
  fallbackErrors: string[] = [],
): LivePlaceholderIssue[] {
  if (deterministicErrors && deterministicErrors.length > 0) {
    return deterministicErrors.map((issue) =>
      mapDeterministicIssue(content, issue),
    );
  }

  return fallbackErrors.map((issue) => {
    const lower = issue.toLowerCase();
    if (lower.includes("spaces are not allowed")) {
      const fieldNameMatch = issue.match(/\{\{([^{}\n]+)\}\}/);
      const token = fieldNameMatch?.[0] ?? "";
      const index = token ? content.indexOf(token) : 0;
      const lc =
        index >= 0 ? indexToLineColumn(content, index) : { line: 1, column: 1 };
      return {
        severity: "error" as const,
        line: lc.line,
        column: lc.column,
        snippet: token,
        message: issue,
        suggestion: "Use snake_case, e.g. {{string:referente_cliente}}",
      };
    }
    if (lower.includes("unsupported type")) {
      const fieldNameMatch = issue.match(/\{\{([^{}\n]+)\}\}/);
      const token = fieldNameMatch?.[0] ?? "";
      const index = token ? content.indexOf(token) : 0;
      const lc =
        index >= 0 ? indexToLineColumn(content, index) : { line: 1, column: 1 };
      return {
        severity: "error" as const,
        line: lc.line,
        column: lc.column,
        snippet: token,
        message: issue,
      };
    }
    if (lower.includes("expected format")) {
      return {
        severity: "error" as const,
        line: 1,
        column: 1,
        snippet: "",
        message:
          "Invalid placeholder format. Expected format: {{type:field_name:length:required}}",
        suggestion: "Length and required are optional: {{string:field_name}}",
      };
    }
    if (lower.includes("unbalanced placeholder braces")) {
      return {
        severity: "error" as const,
        line: 1,
        column: 1,
        snippet: "",
        message: issue,
        suggestion: "Check that every {{ has a matching }}.",
      };
    }
    return {
      severity: "error" as const,
      line: 1,
      column: 1,
      snippet: "",
      message: issue,
    };
  });
}

function mergeValidationIssues(
  localIssues: LivePlaceholderIssue[],
  backendIssues: LivePlaceholderIssue[],
): LivePlaceholderIssue[] {
  const out: LivePlaceholderIssue[] = [];
  const seen = new Set<string>();
  for (const issue of [...localIssues, ...backendIssues]) {
    const key = `${issue.severity}:${issue.line}:${issue.column}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    if (a.severity === b.severity) return 0;
    return a.severity === "error" ? -1 : 1;
  });
}

function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const normalized = (error.message || "").toLowerCase();
    if (
      normalized.includes("ollama request timed out") ||
      normalized.includes("unable to contact ollama")
    ) {
      return "La generazione AI locale sta impiegando troppo tempo. Provare a ridurre la complessita della richiesta o riprovare dopo il caricamento del modello.";
    }
    if (normalized.includes("content should not be empty")) {
      return "Template content cannot be empty.";
    }
    if (normalized.includes("name should not be empty")) {
      return "Template name is required.";
    }
    if (normalized.includes("template name is required")) {
      return "Template name is required.";
    }
    if (normalized.includes("template not found")) {
      return "Template not found on GitHub.";
    }
    if (error.status === 404) return "Resource not found.";
    if (error.status === 400) return "Invalid request. Check required fields.";
    if (error.status === 409)
      return "Conflict: a template with this path already exists.";
    if (error.status === 422)
      return "Request cannot be processed with current data.";
    if (error.status >= 500) return "Server error. Please try again soon.";
    return error.message || fallback;
  }
  return fallback;
}
