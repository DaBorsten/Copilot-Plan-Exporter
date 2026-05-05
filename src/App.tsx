import React, { useState, useCallback, useRef, useEffect } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Toaster, toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FoundPlan {
  requestId: string;
  vsPath: string;
  osPath: string;
  content?: string;
  error?: string;
}

const a = {
  fg: "oklch(0.96 0 0)",
  fgMuted: "oklch(0.68 0 0)",
  fgDim: "oklch(0.50 0 0)",
  err: "oklch(0.70 0.18 22)",
  errBg: "oklch(0.40 0.16 22 / 0.14)",
  errBdr: "oklch(0.55 0.18 22 / 0.35)",
};

/* ── Toggle component ─────────────────────────────────────── */
function ViewToggle({ rendered, onChange }: { rendered: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="flex rounded-lg overflow-hidden shrink-0"
      style={{ border: "1px solid oklch(1 0 0 / 0.1)", background: "oklch(0.16 0 0)" }}
    >
      {[false, true].map((isRendered) => (
        <button
          key={String(isRendered)}
          onClick={() => onChange(isRendered)}
          className="px-3 py-1 text-[0.76rem] font-medium cursor-pointer transition-all duration-150"
          style={{
            color: rendered === isRendered ? "oklch(0.12 0.01 60)" : "oklch(0.55 0 0)",
            background: rendered === isRendered
              ? "linear-gradient(175deg, oklch(0.72 0.18 145) 0%, oklch(0.55 0.18 145) 100%)"
              : "transparent",
            boxShadow: rendered === isRendered
              ? "0 1px 0 oklch(0.88 0.12 145 / 0.5) inset, 0 -1px 0 oklch(0.35 0.12 62 / 0.4) inset"
              : "none",
          }}
        >
          {isRendered ? "Vorschau" : "Quellcode"}
        </button>
      ))}
    </div>
  );
}

/* ── PlanCard component ───────────────────────────────────── */
function PlanCard({
  plan,
  index,
  onCopy,
  onSave,
}: {
  plan: FoundPlan;
  index: number;
  onCopy: (c: string) => void;
  onSave: (c: string, f: string) => void;
}) {
  const [rendered, setRendered] = useState(false);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="glass-header px-4 py-2.5 flex justify-between items-center gap-3">
        <span
          className="text-[0.78rem] font-mono truncate min-w-0 cursor-pointer hover:underline"
          style={{ color: a.fgDim }}
          title={`Datei öffnen: ${plan.osPath}`}
          onClick={() => {
            const dir = plan.osPath.replace(/[^\\\/]+$/, "").replace(/[\\\/]+$/, "");
            openPath(dir);
          }}
        >
          {plan.osPath}
        </span>

        <div className="flex gap-2 shrink-0 items-center">
          {plan.content && <ViewToggle rendered={rendered} onChange={setRendered} />}
          {plan.content && (
            <>
              <button
                className="glass-btn rounded-lg px-3 py-1 text-[0.78rem] font-medium cursor-pointer"
                style={{ color: "oklch(0.82 0 0)" }}
                onClick={() => onCopy(plan.content!)}
              >
                Kopieren
              </button>
              <button
                className="glass-btn rounded-lg px-3 py-1 text-[0.78rem] font-medium cursor-pointer"
                style={{ color: "oklch(0.82 0 0)" }}
                onClick={() => onSave(plan.content!, `plan_${index + 1}.md`)}
              >
                Speichern
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {plan.error ? (
        <pre
          className="m-0 px-5 py-4 text-[0.84rem] leading-[1.7] whitespace-pre-wrap wrap-break-word"
          style={{ color: a.err, fontFamily: "'Geist Variable', ui-monospace, monospace" }}
        >
          {plan.error}
        </pre>
      ) : rendered ? (
        <div className="px-6 py-5 prose-md" style={{ color: "oklch(0.85 0.01 70)" }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 style={{ fontSize: "1.32rem", fontWeight: 700, color: a.fg, marginBottom: "0.5rem", marginTop: "1.25rem", borderBottom: "1px solid oklch(1 0 0 / 0.08)", paddingBottom: "0.35rem" }}>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 style={{ fontSize: "1.12rem", fontWeight: 600, color: a.fg, marginBottom: "0.4rem", marginTop: "1rem" }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: "0.96rem", fontWeight: 600, color: "oklch(0.82 0 0)", marginBottom: "0.3rem", marginTop: "0.85rem" }}>{children}</h3>
              ),
              p: ({ children }) => (
                <p style={{ fontSize: "0.88rem", lineHeight: 1.75, marginBottom: "0.65rem", color: "oklch(0.78 0.01 70)" }}>{children}</p>
              ),
              li: ({ children }) => (
                <li style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "oklch(0.78 0.01 70)", marginBottom: "0.2rem" }}>{children}</li>
              ),
              ul: ({ children }) => (
                <ul style={{ paddingLeft: "1.25rem", marginBottom: "0.65rem", listStyleType: "disc" }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ paddingLeft: "1.25rem", marginBottom: "0.65rem" }}>{children}</ol>
              ),
              code: ({ node, children }: { node?: { tagName?: string; parentNode?: { type?: string; tagName?: string } }; children?: React.ReactNode }) => {
                const isBlock = node?.parentNode?.type === "element" && node?.parentNode?.tagName === "pre";
                return isBlock ? (
                  <code style={{ display: "block", fontSize: "0.81rem", lineHeight: 1.65, color: "oklch(0.78 0.02 70)", fontFamily: "ui-monospace, monospace" }}>{children}</code>
                ) : (
                  <code style={{ fontSize: "0.81rem", padding: "0.1em 0.35em", borderRadius: "4px", background: "oklch(1 0 0 / 0.07)", color: "oklch(0.82 0.08 145)", fontFamily: "ui-monospace, monospace" }}>{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre style={{ margin: "0.65rem 0", padding: "0.85rem 1rem", borderRadius: "10px", background: "oklch(0 0 0 / 0.25)", border: "1px solid oklch(1 0 0 / 0.07)", overflowX: "auto" }}>{children}</pre>
              ),
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: "3px solid oklch(0.72 0.14 78 / 0.5)", paddingLeft: "0.85rem", margin: "0.65rem 0", color: "oklch(0.65 0.03 68)" }}>{children}</blockquote>
              ),
              a: ({ href, children }) => (
                <a href={href} style={{ color: "oklch(0.72 0.18 145)", textDecoration: "underline", textDecorationColor: "oklch(0.72 0.18 145 / 0.4)" }}>{children}</a>
              ),
              hr: () => (
                <hr style={{ border: "none", borderTop: "1px solid oklch(1 0 0 / 0.08)", margin: "1rem 0" }} />
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600, color: "oklch(0.88 0.02 70)" }}>{children}</strong>
              ),
            }}
          >
            {plan.content!}
          </ReactMarkdown>
        </div>
      ) : (
        <pre
          className="m-0 px-5 py-4 overflow-x-auto text-[0.84rem] leading-[1.7] whitespace-pre-wrap wrap-break-word"
          style={{ color: "oklch(0.74 0.025 68)", fontFamily: "'Geist Variable', ui-monospace, monospace" }}
        >
          {plan.content}
        </pre>
      )}
    </div>
  );
}

/* ── App ──────────────────────────────────────────────────── */
function App() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<FoundPlan[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [zoom, setZoom] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem("app-zoom") || "1");
    return isFinite(saved) && saved > 0 ? saved : 1;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("app-zoom", String(zoom));
  }, [zoom]);

  useEffect(() => {
    const clamp = (z: number) => Math.min(3, Math.max(0.5, z));
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clamp(+(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => clamp(+(z + 0.1).toFixed(2))); }
      else if (e.key === "-") { e.preventDefault(); setZoom((z) => clamp(+(z - 0.1).toFixed(2))); }
      else if (e.key === "0") { e.preventDefault(); setZoom(1); }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const processPath = useCallback(async (path: string) => {
    setError(null); setLoading(true); setReplacing(true);
    try {
      const result = await invoke<FoundPlan[]>("extract_plans_from_path", { path });
      setPlans(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPlans(null);
    } finally { setLoading(false); setReplacing(false); }
  }, []);

  const processFile = useCallback(async (file: File) => {
    setError(null); setLoading(true); setReplacing(true);
    try {
      const text = await file.text();
      const result = await invoke<FoundPlan[]>("extract_plans", { json: text });
      setPlans(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setPlans(null);
    } finally { setLoading(false); setReplacing(false); }
  }, []);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        setDragging(false);
        const path = event.payload.paths[0];
        if (path) processPath(path);
      } else if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragging(true);
      } else {
        setDragging(false);
      }
    });
    return () => { unlisten.then(f => f()); };
  }, [processPath]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  }, [processFile]);

  const saveFile = async (content: string, filename: string) => {
    const path = await save({ defaultPath: filename, filters: [{ name: "Markdown", extensions: ["md"] }] });
    if (path) await writeTextFile(path, content);
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content).then(() => toast.success("In Zwischenablage kopiert"));
  };

  return (
    <div className="bg-app min-h-screen text-foreground" style={{ zoom }}>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.17 0 0 / 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid oklch(0.72 0.18 145 / 0.25)",
            boxShadow: "0 1px 0 oklch(1 0 0 / 0.08) inset, 0 8px 32px oklch(0 0 0 / 0.45)",
            color: a.fg,
            fontFamily: "'Geist Variable', sans-serif",
            "--success-bg": "oklch(0.17 0 0 / 0.95)",
            "--success-border": "oklch(0.72 0.18 145 / 0.25)",
            "--success-text": a.fg,
          } as React.CSSProperties,
        }}
      />

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-[1.42rem] font-semibold tracking-[-0.02em] mb-2" style={{ color: a.fg }}>
            Copilot Plan Extractor
          </h1>
          <p className="text-[0.89rem] leading-relaxed" style={{ color: a.fgDim }}>
            Exportierte GitHub-Copilot-Chat-JSON hochladen&nbsp;→ plan.md-Inhalte extrahieren
          </p>
        </header>

        {/* How-to hint */}
        {!plans && !replacing && <details
          className="rounded-xl mb-6"
          style={{ border: "1px solid oklch(1 0 0 / 0.09)", background: "oklch(0.14 0.012 145 / 0.35)", overflow: "visible" }}
        >
          <summary
            className="px-4 py-2.5 text-[0.84rem] font-medium cursor-pointer select-none flex items-center gap-2"
            style={{ color: a.fgMuted, listStyle: "none" }}
          >
            <span style={{ color: "oklch(0.72 0.18 145)" }}>▸</span>
            Wie exportiere ich den Chat in VS&nbsp;Code?
          </summary>
          <div className="px-4 pb-4 pt-2">
            <p className="text-[0.81rem] mb-2" style={{ color: "oklch(0.68 0 0)", lineHeight: 1.7 }}>
              Öffne GitHub Copilot Chat in VS Code und führe den Befehl{" "}
              <strong style={{ color: "oklch(0.88 0 0)" }}>„Export Chat…"</strong> aus.
              Dadurch wird eine{" "}
              <code className="rounded px-1" style={{ fontSize: "0.78rem", background: "oklch(1 0 0 / 0.07)", color: "oklch(0.82 0.08 145)", fontFamily: "ui-monospace, monospace" }}>chat.json</code>{" "}
              Datei gespeichert, die du hier einlesen kannst.
            </p>
            <div className="flex flex-col gap-1.5 mb-3">
              <div className="flex gap-2 text-[0.78rem]" style={{ color: "oklch(0.62 0 0)", alignItems: "center", paddingBottom: "3px" }}>
                <span style={{ color: "oklch(0.50 0 0)", fontVariantNumeric: "normal" }}>1.</span>
                <span>Befehlspalette öffnen:</span>
                <KbdGroup>
                  <Kbd className="bg-[oklch(1_0_0/0.07)] text-[oklch(0.82_0.08_145)] border-0">Strg</Kbd>
                  <span style={{ color: "oklch(0.50 0 0)" }}>+</span>
                  <Kbd className="bg-[oklch(1_0_0/0.07)] text-[oklch(0.82_0.08_145)] border-0">Shift</Kbd>
                  <span style={{ color: "oklch(0.50 0 0)" }}>+</span>
                  <Kbd className="bg-[oklch(1_0_0/0.07)] text-[oklch(0.82_0.08_145)] border-0">P</Kbd>
                </KbdGroup>
              </div>
              <div className="flex gap-2 text-[0.78rem]" style={{ color: "oklch(0.62 0 0)", alignItems: "center" }}>
                <span style={{ color: "oklch(0.50 0 0)", fontVariantNumeric: "normal" }}>2.</span>
                <span>Oder direkt oben in die Suchleiste klicken und eingeben:</span>
                <code style={{ fontSize: "0.78rem", background: "oklch(1 0 0 / 0.07)", color: "oklch(0.82 0.08 145)", fontFamily: "ui-monospace, monospace", padding: "2px 6px", borderRadius: "4px" }}>&gt;Chat: Export Chat</code>
              </div>
            </div>
            <img
              src="/export-chat.png"
              alt="VS Code – Export Chat Screenshot"
              className="rounded-lg block"
              style={{ border: "1px solid oklch(1 0 0 / 0.08)", width: "100%", height: "auto", background: "oklch(0 0 0 / 0.2)" }}
            />
          </div>
        </details>}

        {/* Drop Zone */}
        {!plans && !replacing ? (
          <div
            className={`glass-drop-zone rounded-2xl p-10 text-center cursor-pointer mb-5 ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="pointer-events-none">
              <div
                className="w-16 h-16 rounded-2xl glass flex items-center justify-center text-2xl mx-auto mb-5"
                style={{
                  background: "linear-gradient(155deg, oklch(1 0 0 / 0.08) 0%, oklch(0.72 0.12 145 / 0.04) 100%)",
                  boxShadow: "0 1px 0 oklch(1 0 0 / 0.18) inset, 0 -1px 0 oklch(0 0 0 / 0.15) inset, 0 8px 24px oklch(0 0 0 / 0.3)",
                }}
              >
                {loading ? (
                  <span className="spinner-amber w-5 h-5 rounded-full border-2 animate-spin inline-block" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="oklch(0.72 0.18 145)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 4px oklch(0.7 0.18 145 / 0.4))" }}>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M12 11v6M9 14h6" />
                  </svg>
                )}
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: a.fgMuted }}>
                {loading ? "Verarbeite Datei…" : "chat.json hier ablegen"}
              </p>
              <p className="text-xs mb-6" style={{ color: a.fgDim }}>
                oder Button klicken zum Auswählen
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onFileChange} />
            {!loading && (
              <button
                className="glass-primary-btn rounded-xl px-6 py-2 text-sm font-semibold cursor-pointer tracking-[-0.01em]"
                style={{ color: "oklch(0.12 0.01 60)" }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Datei auswählen
              </button>
            )}
          </div>
        ) : (
          <div
            className={`glass-drop-zone rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-4 cursor-pointer ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.72 0.18 145)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M12 11v6M9 14h6" />
              </svg>
              <span className="text-[0.86rem]" style={{ color: a.fgMuted }}>
                {loading ? "Verarbeite Datei…" : "Neue chat.json hier ablegen oder klicken"}
              </span>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onFileChange} />
            <button
              className="glass-btn rounded-lg px-3 py-1 text-[0.78rem] font-medium cursor-pointer"
              style={{ color: "oklch(0.82 0 0)" }}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Datei wechseln
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 mb-5 text-[0.89rem] flex items-start gap-2.5"
            style={{ background: a.errBg, border: `1px solid ${a.errBdr}`, color: a.err }}
          >
            <span className="mt-px shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {plans && (
          <section>
            <p className="text-[0.76rem] font-semibold uppercase tracking-widest mb-3 pl-1" style={{ color: a.fgDim }}>
              {plans.length} {plans.length === 1 ? "Eintrag" : "Einträge"} gefunden
            </p>
            <div className="flex flex-col gap-3">
              {plans.map((plan, i) => (
                <PlanCard key={i} plan={plan} index={i} onCopy={copyContent} onSave={saveFile} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
