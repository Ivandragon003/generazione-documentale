import { EventEmitter } from "node:events";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentEventsService {
  private readonly emitter = new EventEmitter();
  private static readonly EVENT = "document.finalized";

  onDocumentFinalized(listener: (payload: { jobId: string }) => void): void {
    this.emitter.on(DocumentEventsService.EVENT, listener);
  }

  emitDocumentFinalized(payload: { jobId: string }): void {
    this.emitter.emit(DocumentEventsService.EVENT, payload);
  }
}
