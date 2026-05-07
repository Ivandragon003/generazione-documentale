import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { DocumentEntity } from "./document.entity";

@Entity({ name: "pdf_jobs" })
@Check(
  "ck_pdf_jobs_status",
  `"status" IN ('queued', 'running', 'completed', 'failed')`,
)
export class PdfJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_pdf_jobs_document_id")
  @Column({ type: "uuid" })
  document_id!: string;

  @ManyToOne(
    () => DocumentEntity,
    (document) => document.pdf_jobs,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "document_id" })
  document?: DocumentEntity;

  @Index("idx_pdf_jobs_status")
  @Column({ type: "varchar", length: 50, default: "queued" })
  status!: "queued" | "running" | "completed" | "failed";

  @Column({ type: "varchar", length: 500, nullable: true })
  filename!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  unresolved_fields!: string[];

  @Column({ name: "error_message", type: "text", nullable: true })
  error_message!: string | null;

  @Column({ type: "varchar", length: 255, default: "system" })
  requested_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  started_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completed_at!: Date | null;
}
