import type { Chunk } from './chunker';

export interface DocumentRecord {
  id: string;
  title: string;
  chunks: Chunk[];
  createdAt: string;
  totalTokens: number;
}

export class DocumentStore {
  private readonly documents = new Map<string, DocumentRecord>();

  private latestId: string | null = null;

  set(id: string, document: DocumentRecord): void {
    this.documents.set(id, document);
    this.latestId = id;
  }

  get(id: string): DocumentRecord | undefined {
    return this.documents.get(id);
  }

  getLatest(): DocumentRecord | undefined {
    if (!this.latestId) {
      return undefined;
    }
    return this.documents.get(this.latestId);
  }
}

export const documentStore = new DocumentStore();
