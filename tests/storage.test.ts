import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { SongLibrary } from "../src/core/SongLibrary";
import { createSong, EXAMPLES } from "../src/core/examples";
import { DEFAULT_PREFS } from "../src/core/MusicModel";
it("persiste canciones, preferencias y posición en IndexedDB", async () => {
  const song = createSong("Persistencia", "Autora", EXAMPLES[0].text);
  song.position = 2;
  await SongLibrary.save(song);
  expect((await SongLibrary.all()).find((s) => s.id === song.id)).toEqual(song);
  await SongLibrary.savePreferences({ ...DEFAULT_PREFS, speed: 75 });
  expect((await SongLibrary.preferences())?.speed).toBe(75);
  await SongLibrary.saveActive(song.id);
  expect(await SongLibrary.active()).toBe(song.id);
  await SongLibrary.remove(song.id);
  expect(
    (await SongLibrary.all()).find((s) => s.id === song.id),
  ).toBeUndefined();
});
