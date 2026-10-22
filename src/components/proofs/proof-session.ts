import type { Proof } from '../../contracts/proofs';
import {
  readProofs,
  selectUpload,
  uploadProof,
  type ProofFetch,
  type UploadChoice,
} from './proof-client';

export type ProofState = {
  kind: 'loading' | 'ready' | 'unavailable' | 'denied' | 'signed-out';
  proofs: Proof[] | null;
  stale: boolean;
  pending: boolean;
  choice: UploadChoice | null;
  error: string;
  message: string;
};
export const initialProofState: ProofState = {
  kind: 'loading',
  proofs: null,
  stale: false,
  pending: false,
  choice: null,
  error: '',
  message: '',
};
const readErrors = {
  unavailable: 'Private proof service unavailable. Refresh to try again.',
  denied:
    'Private evidence is no longer accessible. Refresh your order or desk.',
  'signed-out': 'Your session ended. Sign in again to access private evidence.',
};
// One session per order + assignment + actor view. Disposal invalidates all in-flight work.
export class ProofSession {
  value: ProofState = { ...initialProofState };
  private generation = 0;
  private disposed = false;
  constructor(
    readonly order: string,
    readonly assignment: string | undefined,
    private csrf: string,
    private fetcher: ProofFetch,
    private changed: (state: ProofState) => void = () => {},
  ) {}
  private update(patch: Partial<ProofState>) {
    if (this.disposed) return;
    this.value = { ...this.value, ...patch };
    this.changed(this.value);
  }
  dispose() {
    this.disposed = true;
    this.generation++;
  }
  private async read() {
    const generation = ++this.generation;
    const result = await readProofs(this.fetcher, this.order, this.assignment);
    if (this.disposed || generation !== this.generation) return;
    if (result.kind === 'ready')
      this.update({
        kind: 'ready',
        proofs: result.proofs,
        stale: false,
        error: '',
      });
    else
      this.update({
        kind: result.kind,
        proofs: result.kind === 'unavailable' ? this.value.proofs : null,
        stale: this.value.proofs !== null,
        error: readErrors[result.kind],
        ...(result.kind !== 'unavailable' ? { choice: null } : {}),
      });
  }
  async refresh() {
    if (this.disposed || this.value.pending) return;
    this.update({ pending: true });
    await this.read();
    this.update({ pending: false });
  }
  select(files: readonly File[]) {
    if (this.disposed || this.value.pending || !this.assignment) return;
    try {
      const choice = selectUpload(
        files,
        this.value.proofs ?? [],
        this.assignment,
      );
      this.update({ choice, error: '', message: '' });
    } catch (failure) {
      this.update({
        choice: null,
        error:
          failure instanceof Error ? failure.message : 'Cannot select image.',
      });
    }
  }
  async upload() {
    const { choice } = this.value;
    if (
      this.disposed ||
      this.value.pending ||
      this.value.kind !== 'ready' ||
      this.value.stale ||
      !this.assignment ||
      !choice ||
      !this.csrf
    )
      return;
    this.update({
      pending: true,
      error: '',
      message: 'Uploading private evidence…',
    });
    const result = await uploadProof(
      this.fetcher,
      this.order,
      this.assignment,
      this.csrf,
      choice,
    );
    if (this.disposed) return;
    if (result.kind === 'confirmed')
      this.update({
        choice: null,
        message:
          'Evidence upload confirmed by the server. This does not complete the order.',
      });
    else
      this.update({
        message:
          'Upload not confirmed. The list is being refreshed. No automatic retry; use Retry selected upload to reuse the same request.',
      });
    // A newly visible image alone cannot correlate a lost acknowledgement with this request.
    await this.read();
    this.update({ pending: false });
  }
}
