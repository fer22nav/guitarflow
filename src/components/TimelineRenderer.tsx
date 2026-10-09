import { useEffect, useRef, forwardRef } from "react";
import { type MusicModel, type Preferences } from "../core/MusicModel";
import type { PlaybackState } from "../core/PlaybackController";
import {
  Board,
  HEIGHT,
  Marker,
  STRING_Y,
  fretPosition,
  physicalNotes,
} from "./FretboardRenderer";
export function timelinePositions(
  model: MusicModel,
  zoom: number,
  radius = 22,
) {
  let last = 75;
  let prev = -1;
  return model.events.map((e) => {
    last = Math.max(
      last + Math.max(78 * zoom, 2 * radius + 24),
      110 + e.column * 12 * zoom,
      prev === e.column ? last : last,
    );
    prev = e.column;
    return last;
  });
}
interface Props {
  model: MusicModel;
  prefs: Preferences;
  playback: PlaybackState;
  selection: [number, number] | null;
  selectedNote: string | null;
  onSelect: (index: number, noteId: string, extend: boolean) => void;
  exportOnly?: boolean;
}
export const TimelineRenderer = forwardRef<SVGSVGElement, Props>(
  function Renderer(
    {
      model,
      prefs,
      playback,
      selection,
      selectedNote,
      onSelect,
      exportOnly = false,
    },
    ref,
  ) {
    const scroll = useRef<HTMLDivElement>(null);
    const positions = timelinePositions(model, prefs.zoom, prefs.markerSize);
    const isTimeline = prefs.view === "timeline";
    const from = Math.min(prefs.fromFret, prefs.toFret);
    const to = Math.max(prefs.fromFret, Math.min(prefs.toFret, prefs.frets));
    const cell = 100 * prefs.zoom;
    const width = isTimeline
      ? Math.max(1000, (positions.at(-1) ?? 800) + 100 * prefs.zoom)
      : Math.max(1000, 84 + (to - from + 1) * cell + 30);
    const x = positions[playback.index] ?? 130;
    const next = positions[playback.index + 1] ?? x + 78 * prefs.zoom;
    const cursor = x + (next - x) * playback.progress;
    useEffect(() => {
      if (!isTimeline || exportOnly) return;
      const node = scroll.current;
      if (
        node &&
        (cursor > node.scrollLeft + node.clientWidth - 130 ||
          cursor < node.scrollLeft + 90)
      )
        node.scrollTo({
          left: Math.max(0, cursor - node.clientWidth * 0.4),
          behavior: playback.playing ? "auto" : "smooth",
        });
    }, [cursor, isTimeline, exportOnly, playback.playing]);
    const divisions = isTimeline
      ? [
          { x: 75 },
          ...positions.map((x, i) => ({
            x:
              positions[i + 1] !== undefined
                ? (x + positions[i + 1]) / 2
                : x + 70,
          })),
        ]
      : Array.from({ length: to - from + 2 }, (_, i) => ({
          x: 84 + i * cell,
          fret: from + i - 1,
        }));
    const activeIds = new Set(
      model.events[playback.index]?.notes.map((n) => n.id),
    );
    const noteXs = new Map<string, number>();
    model.events.forEach((e, i) =>
      e.notes.forEach((n) => noteXs.set(n.id, positions[i])),
    );
    const physical = physicalNotes(model, playback.index);
    const radius = Math.min(prefs.markerSize, cell * 0.36);
    return (
      <div className="board-scroll" ref={scroll}>
        <svg
          ref={ref}
          aria-label={isTimeline ? "Secuencia de tablatura" : "Mástil físico"}
          role="img"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          style={{ display: "block", minWidth: "100%" }}
        >
          <Board width={width} tuning={model.tuning} divisions={divisions}>
            {isTimeline && selection && (
              <rect
                x={positions[selection[0]] - 38}
                y="50"
                width={positions[selection[1]] - positions[selection[0]] + 76}
                height="293"
                fill="#4c94db"
                opacity=".13"
                stroke="#78b7ff"
                strokeDasharray="4 4"
              />
            )}
            {!exportOnly && isTimeline && (
              <g pointerEvents="none">
                <line
                  x1={cursor}
                  x2={cursor}
                  y1="36"
                  y2="349"
                  stroke="#bcf2d1"
                  strokeWidth="2"
                />
                <path d={`M${cursor - 5} 31h10l-5 7z`} fill="#bcf2d1" />
                <circle cx={cursor} cy="353" r="3" fill="#bcf2d1" />
              </g>
            )}
            {isTimeline
              ? model.events.map((event, index) => (
                  <g key={event.id}>
                    {event.rest && (
                      <text
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(index, "", false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSelect(index, "", false);
                        }}
                        style={{ cursor: "pointer" }}
                        x={positions[index]}
                        y="206"
                        fill="#c3b9a8"
                        textAnchor="middle"
                        fontSize="18"
                      >
                        𝄽
                      </text>
                    )}
                    {event.notes.map((note) => (
                      <g key={note.id}>
                        {note.techniques
                          .filter((t) => t.toNoteId)
                          .map((t, j) => {
                            const tx = noteXs.get(t.toNoteId!);
                            return (
                              tx !== undefined && (
                                <path
                                  key={j}
                                  d={`M${positions[index] + radius} ${STRING_Y(note.string) - 8} Q${(positions[index] + tx) / 2} ${STRING_Y(note.string) - 40} ${tx - radius} ${STRING_Y(note.string) - 8}`}
                                  fill="none"
                                  stroke="#e2c593"
                                  strokeWidth="1.5"
                                />
                              )
                            );
                          })}
                        <Marker
                          note={note}
                          x={positions[index]}
                          radius={prefs.markerSize}
                          active={!exportOnly && activeIds.has(note.id)}
                          selected={selectedNote === note.id}
                          onClick={(extend) => onSelect(index, note.id, extend)}
                        />
                      </g>
                    ))}
                    <text
                      x={positions[index]}
                      y="380"
                      textAnchor="middle"
                      fill="#8c9188"
                      fontFamily="sans-serif"
                      fontSize="11"
                    >
                      {event.durationBeats !== undefined
                        ? `${event.durationBeats} p`
                        : ""}
                    </text>
                  </g>
                ))
              : physical
                  .filter(
                    (n) => n.fret === null || (n.fret >= from && n.fret <= to),
                  )
                  .map((note) => (
                    <Marker
                      key={`${note.string}:${note.fret}`}
                      note={note}
                      x={fretPosition(note.fret ?? from, from, cell)}
                      radius={radius}
                      active={!exportOnly && activeIds.has(note.id)}
                      selected={selectedNote === note.id}
                      onClick={() => {
                        const idx = activeIds.has(note.id)
                          ? playback.index
                          : model.events.findIndex((e) =>
                              e.notes.some((n) => n.id === note.id),
                            );
                        onSelect(idx, note.id, false);
                      }}
                    />
                  ))}
          </Board>
          {!isTimeline &&
            Array.from({ length: to - from + 1 }, (_, i) => (
              <text
                key={i}
                x={fretPosition(from + i, from, cell)}
                y="380"
                fill="#999c97"
                textAnchor="middle"
                fontSize="13"
              >
                {from + i}
              </text>
            ))}
        </svg>
      </div>
    );
  },
);
