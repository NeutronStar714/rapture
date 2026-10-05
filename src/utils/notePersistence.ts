import type { EyelinerNote } from '../types.ts';

/** One document session; all writes are ordered, including retries and empty lists. */
export class NotePersistence {
  fileName = '';
  notes: EyelinerNote[] = [];
  private revision = 0;
  private savedRevision = 0;
  private queue: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private write: (name: string, notes: EyelinerNote[]) => Promise<unknown>,
    private storage: Pick<Storage, 'getItem' | 'setItem'>,
    private changed: (notes: EyelinerNote[]) => void,
    private failed: (message: string | null) => void,
  ) {}

  async activate(name: string) {
    await this.flush();
    const stored = name ? this.storage.getItem(`rapture_eyeliner_${name}`) : null;
    const notes = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(notes)) throw new Error('Stored notes are invalid. Export or recover them before continuing.');
    this.fileName = name;
    this.notes = notes;
    this.revision = this.savedRevision = 0;
    this.changed(notes);
  }

  update(value: EyelinerNote[] | ((previous: EyelinerNote[]) => EyelinerNote[])) {
    this.notes = typeof value === 'function' ? value(this.notes) : value;
    this.revision++;
    this.changed(this.notes);
    try { this.backup(); } catch (error) { this.failed(String(error)); }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 300);
  }

  private backup() {
    if (this.fileName) this.storage.setItem(`rapture_eyeliner_${this.fileName}`, JSON.stringify(this.notes));
  }

  get pending() { return this.revision !== this.savedRevision; }

  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    const operation = this.queue.catch(() => {}).then(async () => {
      while (this.fileName && this.pending) {
        const revision = this.revision;
        const name = this.fileName;
        const snapshot = this.notes.map(note => ({ ...note }));
        // A failed browser backup must be visible, but must not prevent disk recovery.
        let backupError: unknown;
        try { this.backup(); } catch (error) { backupError = error; }
        await this.write(name, snapshot);
        if (backupError) throw new Error(`Notes written to disk, but local recovery failed: ${String(backupError)}`);
        this.savedRevision = revision;
      }
      this.failed(null);
    }).catch(error => { this.failed(String(error)); throw error; });
    this.queue = operation;
    return operation;
  };
}
