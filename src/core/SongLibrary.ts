import { type Song, type Preferences } from "./MusicModel";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("guitarflow", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("songs", { keyPath: "id" });
      r.result.createObjectStore("settings");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
async function operation<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = run(tx.objectStore(store));
    let value: T;
    req.onsuccess = () => {
      value = req.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("No se pudo guardar."));
  });
}
export const SongLibrary = {
  all: () =>
    operation("songs", "readonly", (s) => s.getAll()) as Promise<Song[]>,
  save: (song: Song) => operation("songs", "readwrite", (s) => s.put(song)),
  remove: (id: string) => operation("songs", "readwrite", (s) => s.delete(id)),
  preferences: () =>
    operation("settings", "readonly", (s) => s.get("preferences")) as Promise<
      Preferences | undefined
    >,
  savePreferences: (p: Preferences) =>
    operation("settings", "readwrite", (s) => s.put(p, "preferences")),
  active: () =>
    operation("settings", "readonly", (s) => s.get("active")) as Promise<
      string | undefined
    >,
  saveActive: (id: string) =>
    operation("settings", "readwrite", (s) => s.put(id, "active")),
  async importSongs(songs: Song[]) {
    const d = await db();
    return new Promise<void>((resolve, reject) => {
      const tx = d.transaction("songs", "readwrite");
      for (const song of songs) tx.objectStore("songs").put(song);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};
