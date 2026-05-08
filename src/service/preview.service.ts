import { Inject, Injectable } from "@nestjs/common";
import { makeError } from "../common/utils/errors";
import { DocumentsRepository } from "../repository/documents.repository";
import { DocumentRenderingService } from "./document-rendering.service";

@Injectable()
export class PreviewService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DocumentRenderingService)
    private readonly documentRenderingService: DocumentRenderingService,
  ) {}

  private async findOneOrThrow(id: string) {
    const document = await this.documentsRepository.findById(id);
    if (!document) throw makeError("Documento non trovato", 404);
    return document;
  }

  async getMarkdownPreview(id: string): Promise<{
    content: string;
    unresolvedFields: string[];
  }> {
    const document = await this.findOneOrThrow(id);
    const { result, unresolved } = this.documentRenderingService.renderTemplate(
      document.content,
      document.field_values ?? {},
      false,
    );
    return { content: result, unresolvedFields: unresolved };
  }
}
