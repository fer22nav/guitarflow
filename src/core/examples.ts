import { parseTab } from "./TabParser";
import { uid, type Song } from "./MusicModel";
export const EXAMPLES = [
  {
    title: "Entre cuerdas",
    artist: "Estudio propio · Punteo",
    text: `Frase A\ne|----------------5--7--7--5----------------|\nB|---------5h7----------------7p5-----------|\nG|---4/6----------------------------6\\4----|\nD|-----------------------------------------|\nA|-----------------------------------------|\nE|-----------------------------------------|\n\nFrase B\ne|---7b9~~----7r5----5--5----3~-------------|\nB|-------------------------------5---------|\nG|-----------------------------------------|\nD|-----------------------------------------|\nA|-----------------------------------------|\nE|-----------------------------------------|\nx2`,
  },
  {
    title: "Pulso abierto",
    artist: "Estudio propio · Acordes",
    text: `Acordes y notas apagadas\ne|---0-----0-----x-----3-----3--------------|\nB|---0-----1-----x-----0-----0--------------|\nG|---0-----0-----x-----0-----0--------------|\nD|---2-----2-----x-----0-----0--------------|\nA|---2-----3-----x-----2-----2--------------|\nE|---0-----------x-----3-----3--------------|`,
  },
  {
    title: "Gravedad",
    artist: "Estudio propio · Drop C",
    text: `Drop C · Técnicas\nD|---12/15---15\\12---12h15p12----13b15~~----|\nA|-----------------------------------------|\nF|-----------------------------------------|\nC|-----------------------------------------|\nG|-----------------------------------------|\nC|-----------------------------------------|\nrepeat 4 times`,
  },
];
export function createSong(title = "Sin título", artist = "", text = ""): Song {
  return {
    id: uid(),
    title,
    artist,
    text,
    model: parseTab(text),
    sections: [],
    revisions: [],
    manualEdits: false,
    position: 0,
    updatedAt: Date.now(),
  };
}
export function demoSongs(): Song[] {
  return EXAMPLES.map((x) => createSong(x.title, x.artist, x.text));
}
