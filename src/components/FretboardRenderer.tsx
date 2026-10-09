import { useId, type ReactNode } from "react";
import type { Note, MusicModel } from "../core/MusicModel";
export const STRING_Y = (s: number) => 85 + s * 46;
export const HEIGHT = 410;
export function fretPosition(fret: number, from: number, cell = 100) {
  return 84 + (fret - from) * cell + cell / 2;
}
export function Board({
  width,
  tuning,
  children,
  divisions,
}: {
  width: number;
  tuning: string[];
  children: ReactNode;
  divisions: { x: number; label?: string; fret?: number }[];
}) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <defs>
        <linearGradient id={`wood${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#493122" />
          <stop offset=".5" stopColor="#322318" />
          <stop offset="1" stopColor="#483020" />
        </linearGradient>
        <linearGradient id={`steel${id}`}>
          <stop stopColor="#a3a39d" />
          <stop offset=".5" stopColor="#e4dfd4" />
          <stop offset="1" stopColor="#727671" />
        </linearGradient>
      </defs>
      <rect width={width} height={HEIGHT} fill="#111211" rx="14" />
      <rect
        x="74"
        y="49"
        width={width - 89}
        height="294"
        rx="8"
        fill={`url(#wood${id})`}
      />
      {Array.from({ length: 22 }, (_, i) => (
        <path
          key={i}
          d={`M76 ${57 + i * 13} Q${width * 0.35} ${47 + i * 13} ${width - 17} ${57 + i * 13}`}
          stroke="#bf9467"
          strokeWidth=".6"
          opacity=".085"
          fill="none"
        />
      ))}
      {divisions.map((d, i) => (
        <g key={i}>
          <rect
            x={d.x - 1.5}
            y="50"
            width="3"
            height="292"
            fill={`url(#steel${id})`}
            opacity=".8"
          />
          {d.label && (
            <text
              x={d.x}
              y="380"
              textAnchor="middle"
              fill="#999c97"
              fontFamily="sans-serif"
              fontSize="13"
            >
              {d.label}
            </text>
          )}
          {d.fret !== undefined &&
            [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(d.fret) && (
              <>
                <circle
                  cx={d.x - 50}
                  cy={d.fret % 12 === 0 ? 154 : 200}
                  r="7"
                  fill="#c5bba8"
                  opacity=".33"
                />
                {d.fret % 12 === 0 && (
                  <circle
                    cx={d.x - 50}
                    cy="245"
                    r="7"
                    fill="#c5bba8"
                    opacity=".33"
                  />
                )}
              </>
            )}
        </g>
      ))}
      {tuning.map((t, s) => (
        <g key={s}>
          <line
            x1="75"
            x2={width - 16}
            y1={STRING_Y(s)}
            y2={STRING_Y(s)}
            stroke="#050505"
            strokeWidth={1.2 + s * 0.55}
            transform="translate(0 2)"
            opacity=".55"
          />
          <line
            x1="75"
            x2={width - 16}
            y1={STRING_Y(s)}
            y2={STRING_Y(s)}
            stroke="#c3b9a8"
            strokeWidth={1 + s * 0.48}
          />
        </g>
      ))}
      <StringLabels tuning={tuning} />
      {children}
    </>
  );
}
export function StringLabels({ tuning }: { tuning: string[] }) {
  return (
    <>
      {tuning.map((t, s) => (
        <g key={s}>
          <text
            x="27"
            y={STRING_Y(s) + 5}
            textAnchor="middle"
            fill="#d0d0ca"
            fontFamily="sans-serif"
            fontWeight="600"
            fontSize="15"
          >
            {t}
          </text>
          <text
            x="50"
            y={STRING_Y(s) + 4}
            fill="#656861"
            fontFamily="sans-serif"
            fontSize="10"
          >
            {s + 1}
          </text>
        </g>
      ))}
    </>
  );
}
export function Marker({
  note,
  x,
  active,
  selected,
  radius,
  onClick,
}: {
  note: Note;
  x: number;
  active: boolean;
  selected: boolean;
  radius: number;
  onClick: (extend: boolean) => void;
}) {
  const y = STRING_Y(note.string);
  const tech = note.techniques
    .map((t) =>
      t.kind === "bend"
        ? `↗ ${t.target ?? "?"}`
        : t.kind === "release"
          ? `↘ ${t.target ?? "?"}`
          : t.kind === "vibrato"
            ? "≈"
            : t.kind === "hammer"
              ? "h"
              : t.kind === "pull"
                ? "p"
                : t.kind === "slide-up"
                  ? "↗"
                  : "↘",
    )
    .join(" ");
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Cuerda ${note.string + 1}, ${note.fret === null ? "apagada" : `traste ${note.fret}`}${tech ? `, ${tech}` : ""}`}
      onClick={(e) => onClick(e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e.shiftKey);
        }
      }}
      style={{ cursor: "pointer" }}
      data-note={note.id}
      data-fret={note.fret ?? "x"}
      data-x={x}
    >
      <title>
        {note.source.raw} · Cuerda {note.string + 1}
      </title>
      {active && (
        <circle cx={x} cy={y} r={radius + 7} fill="#92ffc3" opacity=".17" />
      )}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={active ? "#b9f6d0" : "#2377d5"}
        stroke={selected ? "#cfe3ff" : active ? "#e2ffee" : "#559ced"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text
        x={x}
        y={y + 1}
        dominantBaseline="middle"
        textAnchor="middle"
        fill={active ? "#123722" : "#fff"}
        fontFamily="sans-serif"
        fontWeight="700"
        fontSize={radius * 0.88}
      >
        {note.fret ?? "×"}
      </text>
      {tech && (
        <text
          x={x}
          y={y - radius - 10}
          textAnchor="middle"
          fill={active ? "#b9f6d0" : "#e8e0d3"}
          fontFamily="sans-serif"
          fontSize="12"
          fontWeight="600"
        >
          {tech}
        </text>
      )}
    </g>
  );
}
export function physicalNotes(model: MusicModel, active: number) {
  const map = new Map<string, Note>();
  model.events.forEach((e) =>
    e.notes.forEach((n) => map.set(`${n.string}:${n.fret}`, n)),
  );
  model.events[active]?.notes.forEach((n) =>
    map.set(`${n.string}:${n.fret}`, n),
  );
  return [...map.values()];
}
