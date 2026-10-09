import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PREFS,
  TUNINGS,
  uid,
  type Song,
  type Preferences,
  type Note,
  type TechniqueKind,
  eventBeats,
} from "./core/MusicModel";
import { parseTab } from "./core/TabParser";
import { SongLibrary } from "./core/SongLibrary";
import { createSong, demoSongs } from "./core/examples";
import {
  PlaybackController,
  type PlaybackState,
} from "./core/PlaybackController";
import { exportLibrary, readLibrary, exportVisual } from "./core/ImportExport";
import { TimelineRenderer } from "./components/TimelineRenderer";
import { Icon } from "./components/Icon";
import { CaptureImporter } from "./components/CaptureImporter";
import { CueAudio } from "./core/CueAudio";
import { Panel } from "./components/Panel";
const techniqueNames: Record<TechniqueKind, string> = {
  bend: "Bend",
  release: "Release",
  "slide-up": "Slide ascendente",
  "slide-down": "Slide descendente",
  hammer: "Hammer-on",
  pull: "Pull-off",
  vibrato: "Vibrato",
};
function Button({
  icon,
  label,
  onClick,
  disabled = false,
  className = "",
}: {
  icon?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon && <Icon name={icon} />}
      <span>{label}</span>
    </button>
  );
}
function NumberField({
  label,
  value,
  min = 0,
  max = 256,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== "") {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }
        }}
      />
    </label>
  );
}
export default function App() {
  const audio = useRef(new CueAudio());
  type PanelName =
    | "library"
    | "settings"
    | "fragments"
    | "editor"
    | "capture"
    | "note"
    | "export";
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [menu, setMenu] = useState<"load" | "more" | null>(null);
  const setCaptureOpen = (open: boolean) => setPanel(open ? "capture" : null);
  const [captureReviewed, setCaptureReviewed] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [active, setActive] = useState("");
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Cargando biblioteca…");
  const [error, setError] = useState("");
  const setEditor = (open: boolean) => setPanel(open ? "editor" : null);

  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [playback, setPlayback] = useState<PlaybackState>({
    index: 0,
    progress: 0,
    playing: false,
    waiting: false,
  });
  const [manualRepeatCount, setManualRepeatCount] = useState(2);
  const [newSong, setNewSong] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const controller = useRef<PlaybackController | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const exportSvg = useRef<SVGSVGElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const song = songs.find((s) => s.id === active);
  const songRef = useRef(song);
  songRef.current = song;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const updateSong = useCallback(
    (fn: (s: Song) => Song) =>
      setSongs((all) =>
        all.map((s) =>
          s.id === active ? { ...fn(s), updatedAt: Date.now() } : s,
        ),
      ),
    [active],
  );
  const preference = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => setPrefs((p) => ({ ...p, [key]: value }));
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [existing, settings, id] = await Promise.all([
          SongLibrary.all(),
          SongLibrary.preferences(),
          SongLibrary.active(),
        ]);
        if (!alive) return;
        const all = existing.length ? existing : demoSongs();
        if (!existing.length) await SongLibrary.importSongs(all);
        setSongs(all);
        setActive(all.some((s) => s.id === id) ? id! : all[0].id);
        if (settings) setPrefs({ ...DEFAULT_PREFS, ...settings });
        setReady(true);
        setStatus("Guardado en este navegador");
      } catch (e) {
        setError(
          `No se pudo abrir IndexedDB: ${String(e)}. Revisá el permiso de almacenamiento del navegador.`,
        );
        setStatus("Almacenamiento no disponible");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    setStatus("Guardando…");
    const t = setTimeout(() => {
      Promise.all(songs.map((s) => SongLibrary.save(s)))
        .then(() => setStatus("Guardado en este navegador"))
        .catch((e) => {
          setError(`No se pudo guardar: ${String(e)}`);
          setStatus("Error al guardar");
        });
    }, 200);
    return () => clearTimeout(t);
  }, [songs, ready]);
  useEffect(() => {
    if (ready)
      SongLibrary.savePreferences(prefs).catch((e) => setError(String(e)));
  }, [prefs, ready]);
  useEffect(() => {
    if (!ready || !active) return;
    SongLibrary.saveActive(active).catch((e) => setError(String(e)));
    const current = songRef.current;
    if (!current) return;
    setDraft(current.draft ?? current.text);
    setCaptureReviewed(!current.captureNeedsReview);
    setSelectedNote(null);
    setSelection(null);
    setAnchor(null);
    setSelecting(false);
    setShowHistory(false);
    const id = active;
    const c = new PlaybackController(current.model, prefsRef.current, (s) => {
      setPlayback(s);
      setSongs((all) =>
        all.map((item) =>
          item.id === id && item.position !== s.index
            ? { ...item, position: s.index }
            : item,
        ),
      );
    });
    c.onCue = (kind) => {
      const p = prefsRef.current;
      if (
        (kind === "event" && p.audioMode === "event") ||
        (kind === "pulse" && p.audioMode === "metronome")
      )
        audio.current.pip(kind, p.volume);
    };
    controller.current = c;
    c.seek(current.position);
    return () => {
      c.dispose();
      audio.current.quiet();
      controller.current = null;
    };
  }, [active, ready]);
  useEffect(() => {
    if (song) controller.current?.configure(song.model, prefs, selection);
  }, [song, prefs, selection]);
  useEffect(() => {
    const save = () => {
      const current = songRef.current;
      if (current) void SongLibrary.save(current);
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, []);
  const note = song?.model.events
    .flatMap((e) => e.notes)
    .find((n) => n.id === selectedNote);
  const currentEvent = song?.model.events[playback.index];
  const filtered = songs.filter((s) =>
    `${s.title} ${s.artist}`.toLowerCase().includes(search.toLowerCase()),
  );
  const blocking = song?.model.diagnostics.some(
    (d) =>
      d.severity === "error" ||
      /repetici[oó]n.*ambigua|repeticiones ambigua|Barras de repetición incompletas|Indicación de repetición ambigua/i.test(
        d.message,
      ),
  );
  function addSong() {
    controller.current?.pause();
    const s = createSong("Nueva canción");
    setSongs((all) => [s, ...all]);
    setActive(s.id);
    setEditor(true);
    setNewSong(true);
  }
  async function deleteSong() {
    if (!song || !window.confirm(`¿Eliminar «${song.title}» de la biblioteca?`))
      return;
    controller.current?.pause();
    try {
      await SongLibrary.remove(song.id);
      const remaining = songs.filter((s) => s.id !== song.id);
      if (!remaining.length) {
        const blank = createSong("Nueva canción");
        remaining.push(blank);
        setEditor(true);
      }
      setSongs(remaining);
      setActive(remaining[0].id);
    } catch (e) {
      setError(String(e));
    }
  }
  function importTab() {
    if (!song) return;
    if (song.captureNeedsReview && !captureReviewed) {
      setError(
        "Revisá el texto detectado y confirmá los números y técnicas antes de interpretarlo.",
      );
      return;
    }
    if (
      song.manualEdits &&
      !window.confirm(
        "Reinterpretar el texto reemplazará los ajustes manuales y los fragmentos. Se guardará una versión anterior para recuperarlos. ¿Continuar?",
      )
    )
      return;
    const model = parseTab(draft, song.model.tuning);
    if (model.diagnostics.some((d) => d.severity === "error")) {
      setError(
        model.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => `Línea ${d.line}: ${d.message}`)
          .join("\n"),
      );
      return;
    }
    controller.current?.stop();
    updateSong((s) => ({
      ...s,
      text: draft,
      draft: undefined,
      captureNeedsReview: false,
      model,
      revisions: [
        { at: Date.now(), text: s.text, model: s.model, sections: s.sections },
        ...s.revisions,
      ].slice(0, 10),
      sections: [],
      position: 0,
      manualEdits: false,
    }));
    setSelection(null);
    setSelectedNote(null);
    setError("");
    setNewSong(false);
    setPanel(null);
  }
  function select(index: number, id: string, extend: boolean) {
    controller.current?.pause();
    controller.current?.seek(index);
    setSelectedNote(id);
    if (extend && anchor === null && !selecting) {
      setSelection([
        Math.min(playback.index, index),
        Math.max(playback.index, index),
      ]);
    } else if (selecting || extend) {
      if (anchor === null) {
        setAnchor(index);
        setSelection([index, index]);
      } else {
        setSelection([Math.min(anchor, index), Math.max(anchor, index)]);
        setSelecting(false);
        setAnchor(null);
        setPanel("fragments");
      }
    }
  }
  function editNote(patch: Partial<Note>) {
    if (
      patch.string !== undefined &&
      currentEvent?.notes.some(
        (n) => n.id !== selectedNote && n.string === patch.string,
      )
    ) {
      setError(
        "Ya hay otra nota en esa cuerda en el mismo evento. Elegí otra cuerda.",
      );
      return;
    }
    controller.current?.pause();
    updateSong((s) => ({
      ...s,
      manualEdits: true,
      model: {
        ...s.model,
        events: s.model.events.map((e) => ({
          ...e,
          notes: e.notes.map((n) =>
            n.id === selectedNote
              ? { ...n, ...patch }
              : {
                  ...n,
                  techniques: n.techniques.flatMap((t) =>
                    t.toNoteId === selectedNote
                      ? patch.string !== undefined && patch.string !== n.string
                        ? []
                        : [
                            {
                              ...t,
                              target:
                                patch.fret === null
                                  ? undefined
                                  : (patch.fret ?? t.target),
                            },
                          ]
                      : [t],
                  ),
                },
          ),
        })),
      },
    }));
  }
  function editTiming(
    field: "durationBeats" | "gapBeats",
    value: number | undefined,
  ) {
    controller.current?.pause();
    updateSong((s) => ({
      ...s,
      manualEdits: true,
      model: {
        ...s.model,
        events: s.model.events.map((e, i) =>
          i === playback.index ? { ...e, [field]: value } : e,
        ),
      },
    }));
  }
  function editTechnique(kind: string, target?: number) {
    if (!note || !song) return;
    const techniques = note.techniques.filter((t) => t.kind === "vibrato");
    if (kind) {
      const next = song.model.events
        .slice(playback.index + 1)
        .flatMap((e) => e.notes)
        .find((n) => n.string === note.string);
      const linked = ["hammer", "pull", "slide-up", "slide-down"].includes(
        kind,
      );
      if (linked && !next) {
        setError(
          "Esta técnica necesita una nota siguiente en la misma cuerda. Agregá ambas posiciones en el editor ASCII.",
        );
        return;
      }
      techniques.unshift({
        kind: kind as TechniqueKind,
        target: linked ? (next!.fret ?? undefined) : (target ?? note.fret ?? 0),
        ...(linked ? { toNoteId: next!.id } : {}),
      });
    }
    editNote({ techniques });
  }
  function addRest() {
    if (!song) return;
    controller.current?.pause();
    const after = playback.index;
    updateSong((s) => {
      const events = [...s.model.events];
      const col = events[after]?.column ?? 0;
      const next = events[after + 1]?.column ?? col + 4;
      events.splice(after + 1, 0, {
        id: uid(),
        column: (col + next) / 2,
        block: events[after]?.block ?? 0,
        notes: [],
        rest: true,
        durationBeats: 1,
      });
      return {
        ...s,
        manualEdits: true,
        model: {
          ...s.model,
          events,
          blocks: s.model.blocks.map((b) => ({
            ...b,
            start: b.start > after ? b.start + 1 : b.start,
            end: b.end >= after ? b.end + 1 : b.end,
          })),
          repeats: s.model.repeats.map((r) => ({
            ...r,
            start: r.start > after ? r.start + 1 : r.start,
            end: r.end > after ? r.end + 1 : r.end,
          })),
        },
        sections: s.sections.map((f) => ({
          ...f,
          start: f.start > after ? f.start + 1 : f.start,
          end: f.end > after ? f.end + 1 : f.end,
        })),
      };
    });
    setSelection(null);
    setSelectedNote(null);
    controller.current?.seek(after + 1);
  }
  function saveSection() {
    if (!selection || !sectionName.trim()) return;
    updateSong((s) => ({
      ...s,
      sections: [
        ...s.sections,
        {
          id: uid(),
          name: sectionName.trim(),
          start: selection[0],
          end: selection[1],
        },
      ],
    }));
    setSectionName("");
  }
  function manualRepeat() {
    if (!selection) return;
    if (
      song?.model.diagnostics.some((d) =>
        /repetici[oó]n|repeticiones/i.test(d.message),
      ) &&
      !window.confirm(
        "Usar este rango manual reemplaza las indicaciones de repetición ambiguas detectadas. ¿Confirmás que este es el rango correcto?",
      )
    )
      return;
    updateSong((s) => ({
      ...s,
      manualEdits: true,
      model: {
        ...s.model,
        repeats: [
          ...s.model.repeats.filter(
            (r) => r.end < selection[0] || r.start > selection[1],
          ),
          {
            id: uid(),
            start: selection[0],
            end: selection[1],
            count: manualRepeatCount,
            label: `${manualRepeatCount} veces · manual`,
          },
        ],
        diagnostics: s.model.diagnostics.filter(
          (d) => !/repetici[oó]n|repeticiones|Repetición/i.test(d.message),
        ),
      },
    }));
  }
  async function loadLibrary(file: File) {
    try {
      if (file.size > 30_000_000) throw new Error("El archivo supera 30 MB.");
      const imported = readLibrary(await file.text());
      const merged = imported.map((s) => ({
        ...s,
        id: uid(),
        updatedAt: Date.now(),
      }));
      await SongLibrary.importSongs(merged);
      setSongs((all) => [...all, ...merged]);
      if (merged.length) setActive(merged[0].id);
      setError("");
    } catch (e) {
      setError(
        `No se pudo importar: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const exportModel = useMemo(() => {
    if (!song) return null;
    if (!selection) return song.model;
    const events = song.model.events.slice(selection[0], selection[1] + 1);
    const base = events[0]?.column ?? 0;
    return {
      ...song.model,
      events: events.map((e) => ({ ...e, column: e.column - base })),
      repeats: [],
      blocks: [],
      totalColumns: (events.at(-1)?.column ?? base) - base + 4,
    };
  }, [song, selection]);
  async function saveVisual(format: "svg" | "png") {
    const el = exportSvg.current;
    if (!el || !song) return;
    try {
      await exportVisual(
        el,
        format,
        `guitarflow-${song.title.replace(/[^a-z0-9áéíóúñ-]/gi, "-")}`,
      );
    } catch (e) {
      setError(String(e));
    }
  }
  const primaryTechnique = note?.techniques.find((t) => t.kind !== "vibrato");
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const panelTitles: Record<PanelName, string> = {
    library: "Canciones",
    settings: "Ajustes",
    fragments: "Fragmentos",
    editor: "Editar tablatura",
    capture: "Cargar captura",
    note: "Editar nota",
    export: "Exportar",
  };
  function openPanel(name: PanelName) {
    setMenu(null);
    setPanel(name);
  }
  return (
    <div className="clean-app">
      <main className="clean-workspace">
        <header className="clean-header">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
            <div className="brand-symbol">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span>
              Guitar<span className="brand-flow">Flow</span>
            </span>
          </a>
          <div className="clean-actions">
            <div className="menu-anchor">
              <Button
                icon="plus"
                label="Cargar tablatura"
                onClick={() => setMenu(menu === "load" ? null : "load")}
                className="primary"
              />
              {menu === "load" && (
                <div
                  className="quick-menu"
                  role="menu"
                  aria-label="Cargar tablatura"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      addSong();
                    }}
                  >
                    Pegar texto
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      addSong();
                      setPanel("capture");
                    }}
                  >
                    Importar captura
                  </button>
                </div>
              )}
            </div>
            <div className="menu-anchor">
              <button
                aria-label="Menú"
                aria-haspopup="menu"
                aria-expanded={menu === "more"}
                className="menu-button"
                onClick={() => setMenu(menu === "more" ? null : "more")}
              >
                <Icon name="menu" /> Menú
              </button>
              {menu === "more" && (
                <div className="quick-menu" role="menu" aria-label="Opciones">
                  <button role="menuitem" onClick={() => openPanel("library")}>
                    Canciones
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => openPanel("fragments")}
                  >
                    Fragmentos
                  </button>
                  <button role="menuitem" onClick={() => openPanel("settings")}>
                    Ajustes
                  </button>
                  <button role="menuitem" onClick={() => openPanel("editor")}>
                    Editar tablatura
                  </button>
                  <button
                    role="menuitem"
                    disabled={!selectedNote && !currentEvent?.rest}
                    onClick={() => openPanel("note")}
                  >
                    Editar nota seleccionada
                  </button>
                  <button role="menuitem" onClick={() => openPanel("export")}>
                    Exportar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {menu && <div className="menu-dismiss" onClick={() => setMenu(null)} />}
        {error && !panel && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button aria-label="Cerrar mensaje" onClick={() => setError("")}>
              <Icon name="close" />
            </button>
          </div>
        )}
        {!song ? (
          <div className="loading">Preparando GuitarFlow…</div>
        ) : (
          <>
            <section className="clean-song">
              <div>
                <h1>{song.title || "Sin título"}</h1>
                {song.artist && <p>{song.artist}</p>}
              </div>
              <span className="save-dot" title={status} aria-label={status}>
                <span className="dot" />
              </span>
            </section>
            <section className="practice-card clean-board">
              <div className="clean-board-toolbar">
                <div className="segmented">
                  <button
                    className={prefs.view === "timeline" ? "active" : ""}
                    onClick={() => preference("view", "timeline")}
                  >
                    Secuencia
                  </button>
                  <button
                    className={prefs.view === "physical" ? "active" : ""}
                    onClick={() => preference("view", "physical")}
                  >
                    Mástil físico
                  </button>
                </div>
                <span
                  className="quiet-rhythm"
                  title="El espaciado ASCII ofrece una referencia de tiempo aproximada. Podés ajustarla desde el menú."
                >
                  Ritmo aproximado
                </span>
              </div>
              <TimelineRenderer
                ref={svg}
                model={song.model}
                prefs={prefs}
                playback={playback}
                selection={selection}
                selectedNote={null}
                onSelect={select}
              />
            </section>
            {selecting && (
              <div className="selection-prompt">
                {anchor === null
                  ? "Elegí la primera nota del fragmento."
                  : "Ahora elegí la última nota."}
                <button
                  onClick={() => {
                    setSelecting(false);
                    setAnchor(null);
                    setSelection(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
            <footer className="playback-bar clean-player">
              {" "}
              <div className="transport">
                <button
                  className="icon-button"
                  title="Reiniciar"
                  aria-label="Reiniciar"
                  onClick={() => controller.current?.stop()}
                >
                  <Icon name="restart" />
                </button>
                <button
                  className="icon-button"
                  title="Evento anterior"
                  aria-label="Evento anterior"
                  onClick={() => controller.current?.step(-1)}
                >
                  <Icon name="prev" />
                </button>
                <button
                  className="play-button"
                  aria-label={playback.playing ? "Pausar" : "Reproducir"}
                  title={playback.playing ? "Pausar" : "Reproducir"}
                  disabled={blocking || !song.model.events.length}
                  onClick={() => {
                    if (playback.playing) {
                      controller.current?.pause();
                      audio.current.quiet();
                    } else {
                      void audio.current
                        .enable()
                        .then(() => controller.current?.play())
                        .catch((e) =>
                          setError(
                            `No se pudo activar el sonido: ${String(e)}`,
                          ),
                        );
                    }
                  }}
                >
                  <Icon name={playback.playing ? "pause" : "play"} size={23} />
                </button>
                <button
                  className="icon-button"
                  title="Evento siguiente"
                  aria-label="Evento siguiente"
                  onClick={() => controller.current?.step(1)}
                >
                  <Icon name="next" />
                </button>
                <button
                  className="icon-button"
                  title="Detener"
                  aria-label="Detener"
                  onClick={() => controller.current?.stop()}
                >
                  <Icon name="stop" size={16} />
                </button>
              </div>
              <div className="playback-progress">
                <input
                  aria-label="Posición de reproducción"
                  type="range"
                  min="0"
                  max={Math.max(0, song.model.events.length - 1)}
                  value={playback.index}
                  onChange={(e) => {
                    controller.current?.pause();
                    controller.current?.seek(Number(e.target.value));
                  }}
                />
              </div>{" "}
              <NumberField
                label="BPM"
                value={prefs.bpm}
                min={20}
                max={300}
                onChange={(v) => preference("bpm", v)}
              />
              <button
                className={`loop-button ${prefs.loop ? "active" : ""}`}
                aria-pressed={prefs.loop}
                onClick={() => preference("loop", !prefs.loop)}
                title="Reproducción en bucle"
              >
                <Icon name="loop" size={19} />
                <span>Bucle</span>
              </button>
            </footer>
            {selection && !selecting && (
              <div className="active-fragment">
                <button onClick={() => openPanel("fragments")}>
                  Fragmento seleccionado
                </button>
                <button
                  className="icon-button"
                  aria-label="Quitar selección"
                  onClick={() => setSelection(null)}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}
            {blocking && (
              <div className="needs-review">
                <span>Revisá la tablatura antes de reproducir.</span>
                <button onClick={() => openPanel("editor")}>Revisar</button>
              </div>
            )}
            {panel && (
              <Panel
                title={panelTitles[panel]}
                onClose={() => setPanel(null)}
                wide={panel === "editor" || panel === "capture"}
              >
                {error && (
                  <div className="error-banner" role="alert">
                    <span>{error}</span>
                    <button
                      aria-label="Cerrar mensaje"
                      onClick={() => setError("")}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                )}
                {panel === "library" && (
                  <>
                    {" "}
                    <aside className="sidebar">
                      <Button
                        icon="plus"
                        label="Nueva canción"
                        onClick={addSong}
                        className="new-song"
                      />
                      <div className="library-label">
                        <span>BIBLIOTECA</span>
                        <span>{songs.length.toString().padStart(2, "0")}</span>
                      </div>
                      <label className="search">
                        <Icon name="search" size={16} />
                        <input
                          aria-label="Buscar canciones"
                          placeholder="Buscar canción o artista"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <div className="song-list">
                        {filtered.map((s, i) => (
                          <button
                            key={s.id}
                            className={`song-card ${active === s.id ? "selected" : ""}`}
                            onClick={() => {
                              controller.current?.pause();
                              setActive(s.id);
                              setNewSong(false);
                              setPanel(null);
                            }}
                          >
                            <span className={`song-art art-${i % 3}`}>
                              <Icon name="music" size={22} />
                            </span>
                            <span className="song-info">
                              <strong>{s.title || "Sin título"}</strong>
                              <small>{s.artist || "Sin artista"}</small>
                              <span className="song-tag">
                                {s.model.tuning.slice().reverse().join(" ")}{" "}
                                <i /> {s.model.events.length} eventos
                              </span>
                            </span>
                            {active === s.id && (
                              <span className="selected-dot" />
                            )}
                          </button>
                        ))}
                        {ready && !filtered.length && (
                          <p className="muted empty-search">
                            No hay coincidencias.
                          </p>
                        )}
                      </div>
                      <div className="sidebar-bottom">
                        <div className="local-label">
                          <span className="dot" /> Biblioteca local{" "}
                          <Icon name="check" size={13} />
                        </div>
                        <p>Respaldo de biblioteca · archivo JSON.</p>
                        <div className="library-actions">
                          <Button
                            icon="upload"
                            label="Restaurar respaldo"
                            onClick={() => fileInput.current?.click()}
                          />
                          <Button
                            icon="download"
                            label="Guardar respaldo"
                            onClick={() => exportLibrary(songs)}
                          />
                        </div>
                        <input
                          type="file"
                          accept=".json,application/json"
                          ref={fileInput}
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void loadLibrary(f);
                          }}
                        />
                      </div>
                    </aside>
                  </>
                )}
                {panel === "settings" && (
                  <>
                    {" "}
                    {song && (
                      <section className="settings-panel">
                        {" "}
                        <div className="view-tools">
                          <label>
                            Afinación{" "}
                            <select
                              aria-label="Afinación"
                              value={
                                Object.keys(TUNINGS).find(
                                  (k) =>
                                    TUNINGS[k].join() ===
                                    song.model.tuning.join(),
                                ) ?? "Personalizada"
                              }
                              onChange={(e) => {
                                if (TUNINGS[e.target.value])
                                  updateSong((s) => ({
                                    ...s,
                                    model: {
                                      ...s.model,
                                      tuning: [...TUNINGS[e.target.value]],
                                    },
                                  }));
                              }}
                            >
                              {Object.keys(TUNINGS).map((k) => (
                                <option key={k}>{k}</option>
                              ))}
                              <option>Personalizada</option>
                            </select>
                          </label>
                          <span className="tool-divider" />
                          <label className="zoom-control">
                            Zoom{" "}
                            <input
                              aria-label="Zoom del mástil"
                              type="range"
                              min="0.6"
                              max="2.5"
                              step="0.1"
                              value={prefs.zoom}
                              onChange={(e) =>
                                preference("zoom", Number(e.target.value))
                              }
                            />
                            <span>{Math.round(prefs.zoom * 100)}%</span>
                          </label>
                        </div>{" "}
                        <label className="field speed-field">
                          <span>
                            VELOCIDAD <b>{prefs.speed}%</b>
                          </span>
                          <input
                            aria-label="Velocidad"
                            type="range"
                            min="25"
                            max="200"
                            step="5"
                            value={prefs.speed}
                            onChange={(e) =>
                              preference("speed", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="field audio-field">
                          <span>SONIDO DE GUÍA</span>
                          <select
                            aria-label="Sonido de guía"
                            value={prefs.audioMode}
                            onChange={(e) => {
                              preference(
                                "audioMode",
                                e.target.value as Preferences["audioMode"],
                              );
                              audio.current.quiet();
                              void audio.current
                                .enable()
                                .catch((e) => setError(String(e)));
                            }}
                          >
                            <option value="off">Silencio</option>
                            <option value="event">Pip por evento</option>
                            <option value="metronome">Metrónomo</option>
                          </select>
                        </label>
                        <NumberField
                          label="Cantidad de trastes"
                          value={prefs.frets}
                          min={12}
                          max={24}
                          onChange={(v) => {
                            preference("frets", Math.round(v));
                            preference(
                              "toFret",
                              Math.min(prefs.toFret, Math.round(v)),
                            );
                          }}
                        />
                        <NumberField
                          label="Desde traste"
                          value={prefs.fromFret}
                          max={prefs.toFret}
                          onChange={(v) =>
                            preference("fromFret", Math.round(v))
                          }
                        />
                        <NumberField
                          label="Hasta traste"
                          value={prefs.toFret}
                          min={prefs.fromFret}
                          max={prefs.frets}
                          onChange={(v) => preference("toFret", Math.round(v))}
                        />
                        <NumberField
                          label="Tamaño de notas"
                          value={prefs.markerSize}
                          min={16}
                          max={32}
                          onChange={(v) => preference("markerSize", v)}
                        />
                        <NumberField
                          label="Columnas por pulso"
                          value={prefs.columnsPerBeat}
                          min={1}
                          max={32}
                          step={0.5}
                          onChange={(v) => preference("columnsPerBeat", v)}
                        />
                        <label className="field">
                          <span>Duración de reproducción</span>
                          <select
                            aria-label="Duración de reproducción"
                            value={prefs.timing}
                            onChange={(e) =>
                              preference(
                                "timing",
                                e.target.value as Preferences["timing"],
                              )
                            }
                          >
                            <option value="spacing">
                              Según espaciado ASCII
                            </option>
                            <option value="uniform">Uniforme · 1 pulso</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>
                            Volumen del sonido ·{" "}
                            {Math.round((prefs.volume / 0.3) * 100)}%
                          </span>
                          <input
                            aria-label="Volumen del sonido"
                            type="range"
                            min="0"
                            max="0.3"
                            step="0.01"
                            value={prefs.volume}
                            onChange={(e) =>
                              preference("volume", Number(e.target.value))
                            }
                          />
                        </label>
                        <NumberField
                          label="Pausa entre bucles (seg.)"
                          value={prefs.loopPause}
                          min={0}
                          max={30}
                          step={0.25}
                          onChange={(v) => preference("loopPause", v)}
                        />
                        <label className="field tuning-custom">
                          <span>Afinación manual · cuerdas 1 → 6</span>
                          <input
                            aria-label="Afinación manual"
                            key={song.model.tuning.join()}
                            defaultValue={song.model.tuning.join(" ")}
                            onBlur={(e) => {
                              const v = e.target.value
                                .trim()
                                .split(/[\s,-]+/)
                                .map((x) => x[0]?.toUpperCase() + x.slice(1));
                              if (
                                v.length === 6 &&
                                v.every((x) => /^[A-G](?:#|b)?$/.test(x))
                              )
                                updateSong((s) => ({
                                  ...s,
                                  model: { ...s.model, tuning: v },
                                }));
                              else
                                setError(
                                  "Ingresá seis notas de afinación, de aguda a grave: E B G D A E.",
                                );
                            }}
                          />
                        </label>
                        <p className="settings-note">
                          Los ajustes de tiempo controlan el cursor. La
                          afinación conserva los trastes escritos.
                        </p>
                      </section>
                    )}
                  </>
                )}
                {panel === "fragments" && (
                  <>
                    {" "}
                    <section className="fragments-panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">PRACTICÁ A TU MANERA</span>
                          <h2>
                            Fragmentos de práctica{" "}
                            <span>{song.sections.length}</span>
                          </h2>
                        </div>
                        <Button
                          icon="plus"
                          label={
                            selecting
                              ? "Elegí inicio y final"
                              : "Seleccionar fragmento"
                          }
                          onClick={() => {
                            setSelecting(!selecting);
                            setPanel(null);
                            setAnchor(null);
                            setSelection(null);
                            preference("view", "timeline");
                          }}
                          className={selecting ? "active" : ""}
                        />
                      </div>
                      <div className="fragment-list">
                        {song.sections.map((f) => (
                          <div
                            className={`fragment ${selection?.[0] === f.start && selection?.[1] === f.end ? "active" : ""}`}
                            key={f.id}
                          >
                            <button
                              onClick={() => {
                                controller.current?.pause();
                                setSelection([f.start, f.end]);
                                controller.current?.seek(f.start);
                                setPanel(null);
                              }}
                            >
                              <Icon name="loop" />
                              <span>
                                <strong>{f.name}</strong>
                                <small>
                                  {f.end - f.start + 1} eventos · inicio y final
                                  incluidos
                                </small>
                              </span>
                            </button>
                            <button
                              title={`Eliminar fragmento ${f.name}`}
                              aria-label={`Eliminar fragmento ${f.name}`}
                              className="icon-button"
                              onClick={() =>
                                updateSong((s) => ({
                                  ...s,
                                  sections: s.sections.filter(
                                    (x) => x.id !== f.id,
                                  ),
                                }))
                              }
                            >
                              <Icon name="close" size={14} />
                            </button>
                          </div>
                        ))}
                        {!song.sections.length && !selection && (
                          <div className="fragment-empty">
                            <span className="fragment-empty-icon">
                              <Icon name="loop" size={23} />
                            </span>
                            <div>
                              <strong>
                                Enfocate en la parte que querés mejorar.
                              </strong>
                              <p>
                                Seleccioná el inicio y el final de una frase y
                                guardala para practicar en bucle.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      {selection && (
                        <div className="selection-editor">
                          <span className="selection-badge">
                            {selection[1] - selection[0] + 1} eventos
                            seleccionados
                          </span>
                          <input
                            aria-label="Nombre del fragmento"
                            value={sectionName}
                            placeholder="Nombre del fragmento"
                            onChange={(e) => setSectionName(e.target.value)}
                          />
                          <Button
                            icon="plus"
                            label="Guardar fragmento"
                            onClick={saveSection}
                            disabled={!sectionName.trim()}
                          />
                          <Button
                            label="Quitar selección"
                            onClick={() => {
                              setSelection(null);
                              setAnchor(null);
                            }}
                          />
                          <div className="repeat-editor">
                            <NumberField
                              label="Repeticiones del rango"
                              value={manualRepeatCount}
                              min={1}
                              max={100}
                              onChange={(v) =>
                                setManualRepeatCount(Math.round(v))
                              }
                            />
                            <Button
                              label="Aplicar repetición manual"
                              onClick={manualRepeat}
                            />
                          </div>
                        </div>
                      )}
                      {song.model.repeats.length > 0 && (
                        <div className="repeat-list">
                          {song.model.repeats.map((r) => (
                            <span key={r.id}>
                              <Icon name="loop" size={13} /> {r.label} ·{" "}
                              {r.end - r.start + 1} eventos{" "}
                              <button
                                title="Quitar repetición"
                                aria-label="Quitar repetición"
                                onClick={() =>
                                  updateSong((s) => ({
                                    ...s,
                                    model: {
                                      ...s.model,
                                      repeats: s.model.repeats.filter(
                                        (x) => x.id !== r.id,
                                      ),
                                    },
                                    manualEdits: true,
                                  }))
                                }
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
                {panel === "note" && (
                  <>
                    {" "}
                    {selectedNote && note && (
                      <section className="note-editor">
                        <div className="section-heading">
                          <h2>
                            Editar nota{" "}
                            <span>
                              cuerda {note.string + 1} · {note.source.raw}
                            </span>
                          </h2>
                          <button
                            className="icon-button"
                            aria-label="Cerrar edición de nota"
                            onClick={() => setSelectedNote(null)}
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                        <div className="note-fields">
                          <label className="field">
                            <span>Cuerda</span>
                            <select
                              aria-label="Cuerda de la nota"
                              value={note.string}
                              onChange={(e) =>
                                editNote({
                                  string: Number(e.target.value),
                                  techniques: note.techniques.filter(
                                    (t) => !t.toNoteId,
                                  ),
                                })
                              }
                            >
                              {song.model.tuning.map((t, i) => (
                                <option key={i} value={i}>
                                  {i + 1} · {t}
                                </option>
                              ))}
                            </select>
                          </label>
                          <NumberField
                            label="Traste"
                            value={note.fret ?? 0}
                            max={24}
                            onChange={(v) => editNote({ fret: Math.round(v) })}
                          />
                          <label className="check-field">
                            <input
                              type="checkbox"
                              checked={note.fret === null}
                              onChange={(e) =>
                                editNote({ fret: e.target.checked ? null : 0 })
                              }
                            />{" "}
                            Nota apagada (x)
                          </label>
                          <label className="field">
                            <span>Técnica</span>
                            <select
                              aria-label="Técnica de la nota"
                              value={primaryTechnique?.kind ?? ""}
                              onChange={(e) => editTechnique(e.target.value)}
                            >
                              <option value="">Sin técnica</option>
                              {Object.entries(techniqueNames)
                                .filter(([k]) => k !== "vibrato")
                                .map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                            </select>
                          </label>
                          {primaryTechnique &&
                            ["bend", "release"].includes(
                              primaryTechnique.kind,
                            ) && (
                              <NumberField
                                label="Sonido del traste destino"
                                value={primaryTechnique.target ?? 0}
                                max={36}
                                onChange={(v) =>
                                  editTechnique(
                                    primaryTechnique.kind,
                                    Math.round(v),
                                  )
                                }
                              />
                            )}
                          <label className="check-field">
                            <input
                              type="checkbox"
                              checked={note.techniques.some(
                                (t) => t.kind === "vibrato",
                              )}
                              onChange={(e) =>
                                editNote({
                                  techniques: e.target.checked
                                    ? [...note.techniques, { kind: "vibrato" }]
                                    : note.techniques.filter(
                                        (t) => t.kind !== "vibrato",
                                      ),
                                })
                              }
                            />{" "}
                            Vibrato
                          </label>
                          <NumberField
                            label="Duración del evento (pulsos)"
                            value={
                              currentEvent?.durationBeats ??
                              eventBeats(song.model, playback.index, prefs)
                            }
                            min={0.0625}
                            step={0.25}
                            onChange={(v) => editTiming("durationBeats", v)}
                          />
                          <NumberField
                            label="Silencio posterior (pulsos)"
                            value={currentEvent?.gapBeats ?? 0}
                            step={0.25}
                            onChange={(v) => editTiming("gapBeats", v)}
                          />
                          <Button
                            label="Restaurar tiempo aproximado"
                            onClick={() => {
                              editTiming("durationBeats", undefined);
                              editTiming("gapBeats", undefined);
                            }}
                          />
                          <Button
                            icon="plus"
                            label="Insertar silencio"
                            onClick={addRest}
                          />
                        </div>
                        <p className="muted">
                          Las duraciones se aplican a todas las notas
                          simultáneas del evento. Las técnicas enlazadas apuntan
                          a la siguiente nota de la misma cuerda.
                        </p>
                      </section>
                    )}
                    {currentEvent?.rest && (
                      <section className="note-editor">
                        <h2>Silencio seleccionado</h2>
                        <NumberField
                          label="Duración (pulsos)"
                          value={currentEvent.durationBeats ?? 1}
                          min={0.0625}
                          step={0.25}
                          onChange={(v) => editTiming("durationBeats", v)}
                        />
                      </section>
                    )}
                  </>
                )}
                {(panel === "editor" || panel === "capture") && (
                  <>
                    {" "}
                    {panel === "capture" && (
                      <CaptureImporter
                        onClose={() => setCaptureOpen(false)}
                        onResult={(r) => {
                          setDraft(r.text);
                          updateSong((s) => ({
                            ...s,
                            draft: r.text,
                            capture: {
                              dataUrl: r.dataUrl,
                              name: r.name,
                              confidence: r.confidence,
                            },
                            captureNeedsReview: true,
                          }));
                          setCaptureReviewed(false);
                          setCaptureOpen(false);
                          setEditor(true);
                        }}
                      />
                    )}
                    {panel === "editor" && (
                      <section className="tab-editor">
                        <div className="song-metadata">
                          <label className="field">
                            <span>Título</span>
                            <input
                              aria-label="Título de canción"
                              value={song.title}
                              onChange={(e) =>
                                updateSong((x) => ({
                                  ...x,
                                  title: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Artista</span>
                            <input
                              aria-label="Artista"
                              value={song.artist}
                              onChange={(e) =>
                                updateSong((x) => ({
                                  ...x,
                                  artist: e.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">FUENTE ORIGINAL</span>
                            <h2>
                              {newSong
                                ? "Pegá tu primera tablatura"
                                : "Editor de tablatura ASCII"}
                            </h2>
                          </div>
                          <Button
                            icon="restart"
                            label="Versiones anteriores"
                            onClick={() => setShowHistory(!showHistory)}
                          />
                        </div>
                        <p className="muted">
                          Pegá bloques de seis cuerdas con fuente monoespaciada.
                          Se respetan los trastes y las columnas originales.
                        </p>
                        {song.capture && (
                          <div className="capture-preview">
                            <img
                              src={song.capture.dataUrl}
                              alt={`Captura original: ${song.capture.name}`}
                            />
                            <div>
                              <strong>
                                Revisá la lectura antes de interpretar
                              </strong>
                              <p>
                                La imagen es tu referencia. Comprobá
                                especialmente trastes de dos dígitos, bends,
                                h/p, barras y alineación de acordes.
                              </p>
                              <label className="check-field">
                                <input
                                  type="checkbox"
                                  checked={captureReviewed}
                                  onChange={(e) =>
                                    setCaptureReviewed(e.target.checked)
                                  }
                                />{" "}
                                Revisé números, técnicas y alineación
                              </label>
                            </div>
                          </div>
                        )}
                        <textarea
                          aria-label="Tablatura ASCII"
                          spellCheck={false}
                          value={draft}
                          placeholder={
                            "e|--------------------\nB|--------------------\nG|--------------------\nD|--------------------\nA|--------------------\nE|--------------------"
                          }
                          onChange={(e) => {
                            setDraft(e.target.value);
                            updateSong((s) => ({
                              ...s,
                              draft: e.target.value,
                            }));
                          }}
                        />
                        <div className="editor-bottom">
                          <span className="muted">
                            {song.manualEdits
                              ? "Hay ajustes manuales. Reinterpretar reemplazará el modelo actual."
                              : "Tu texto original se conserva junto al modelo."}
                          </span>
                          <Button
                            icon="check"
                            label="Interpretar tablatura"
                            onClick={importTab}
                            disabled={
                              !!song.captureNeedsReview && !captureReviewed
                            }
                            className="primary"
                          />
                        </div>
                        {showHistory && (
                          <div className="history">
                            {!song.revisions.length ? (
                              <p className="muted">
                                Todavía no hay versiones anteriores.
                              </p>
                            ) : (
                              song.revisions.map((r, i) => (
                                <div key={r.at}>
                                  <span>
                                    {new Date(r.at).toLocaleString("es-AR")} ·{" "}
                                    {r.model.events.length} eventos
                                  </span>
                                  <Button
                                    label="Recuperar versión"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          "¿Recuperar esta versión? Se conservará también el estado actual.",
                                        )
                                      )
                                        return;
                                      controller.current?.stop();
                                      updateSong((s) => ({
                                        ...s,
                                        text: r.text,
                                        draft: undefined,
                                        model: structuredClone(r.model),
                                        sections: structuredClone(r.sections),
                                        revisions: [
                                          {
                                            at: Date.now(),
                                            text: s.text,
                                            model: s.model,
                                            sections: s.sections,
                                          },
                                          ...s.revisions.filter(
                                            (_, j) => j !== i,
                                          ),
                                        ].slice(0, 10),
                                        position: 0,
                                        manualEdits: true,
                                      }));
                                      setDraft(r.text);
                                      setSelection(null);
                                      setSelectedNote(null);
                                    }}
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </section>
                    )}
                    {song.model.diagnostics.length > 0 && (
                      <details className="diagnostics" open={!!blocking}>
                        <summary>
                          {song.model.diagnostics.length} aviso(s) de
                          interpretación{" "}
                          {blocking ? "· revisá antes de reproducir" : ""}
                        </summary>
                        {song.model.diagnostics.map((d, i) => (
                          <p
                            key={i}
                            className={
                              d.severity === "error" ? "error-text" : ""
                            }
                          >
                            Línea {d.line}: {d.message}
                          </p>
                        ))}
                        <Button
                          label="Corregir en tablatura"
                          icon="code"
                          onClick={() => setEditor(true)}
                        />
                      </details>
                    )}
                  </>
                )}
                {panel === "export" && (
                  <>
                    {" "}
                    <div className="export-row">
                      <div>
                        <Button
                          icon="download"
                          label={selection ? "Fragmento SVG" : "Exportar SVG"}
                          onClick={() => void saveVisual("svg")}
                        />
                        <Button
                          label={selection ? "Fragmento PNG" : "Exportar PNG"}
                          onClick={() => void saveVisual("png")}
                        />
                      </div>
                    </div>
                    <Button
                      icon="download"
                      label="Guardar respaldo de biblioteca"
                      onClick={() => exportLibrary(songs)}
                    />
                  </>
                )}
                {panel === "editor" && (
                  <div className="song-management">
                    <Button
                      icon="copy"
                      label="Duplicar canción"
                      onClick={() => {
                        const copy = structuredClone(song);
                        copy.id = uid();
                        copy.title += " · copia";
                        setSongs((all) => [copy, ...all]);
                        setActive(copy.id);
                        setPanel(null);
                      }}
                    />
                    <Button
                      icon="trash"
                      label="Eliminar canción"
                      onClick={() => void deleteSong()}
                    />
                  </div>
                )}
              </Panel>
            )}
            {exportModel && (
              <div className="export-hidden" aria-hidden="true">
                <TimelineRenderer
                  ref={exportSvg}
                  model={exportModel}
                  prefs={prefs}
                  playback={{
                    index: 0,
                    progress: 0,
                    playing: false,
                    waiting: false,
                  }}
                  selection={null}
                  selectedNote={null}
                  onSelect={() => {}}
                  exportOnly
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
