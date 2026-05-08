import { EventEmitter } from "node:events";
import { Injectable } from "@nestjs/common";

export const DOCUMENT_FINALIZED_EVENT = "document.finalized";

@Injectable()
export class DocumentEventsService {
  private readonly emitter = new EventEmitter();

  onDocumentFinalized(listener: (payload: { jobId: string }) => void): void {
    this.emitter.on(DOCUMENT_FINALIZED_EVENT, listener);
  }

  emitDocumentFinalized(payload: { jobId: string }): void {
    this.emitter.emit(DOCUMENT_FINALIZED_EVENT, payload);
  }
}
