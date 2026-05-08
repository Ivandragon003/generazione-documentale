import { DocumentEventsService, DOCUMENT_FINALIZED_EVENT } from "../src/service/document-events.service";

describe("DocumentEventsService", () => {
  let service: DocumentEventsService;

  beforeEach(() => {
    service = new DocumentEventsService();
  });

  it("deve essere definito", () => {
    expect(service).toBeDefined();
  });

  it("onDocumentFinalized registra il listener e lo invoca su emit", () => {
    const listener = jest.fn();
    service.onDocumentFinalized(listener);
    service.emitDocumentFinalized({ jobId: "job-1" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ jobId: "job-1" });
  });

  it("emitDocumentFinalized non lancia se non ci sono listener", () => {
    expect(() =>
      service.emitDocumentFinalized({ jobId: "job-2" })
    ).not.toThrow();
  });

  it("invoca tutti i listener registrati", () => {
    const l1 = jest.fn();
    const l2 = jest.fn();
    service.onDocumentFinalized(l1);
    service.onDocumentFinalized(l2);
    service.emitDocumentFinalized({ jobId: "job-3" });
    expect(l1).toHaveBeenCalledWith({ jobId: "job-3" });
    expect(l2).toHaveBeenCalledWith({ jobId: "job-3" });
  });

  it("DOCUMENT_FINALIZED_EVENT ha il valore corretto", () => {
    expect(DOCUMENT_FINALIZED_EVENT).toBe("document.finalized");
  });

  it("emette più eventi in sequenza", () => {
    const listener = jest.fn();
    service.onDocumentFinalized(listener);
    service.emitDocumentFinalized({ jobId: "a" });
    service.emitDocumentFinalized({ jobId: "b" });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { jobId: "a" });
    expect(listener).toHaveBeenNthCalledWith(2, { jobId: "b" });
  });
});
