import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { FieldValueMap } from "../service/document-rendering.service";

@Entity({ name: "pdf_jobs" })
@Check(
  "ck_pdf_jobs_status",
  `"status" IN ('queued', 'running', 'completed', 'failed')`,
)
export class PdfJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_pdf_jobs_template_id")
  @Column({ type: "varchar", length: 512 })
  template_id!: string;

  @Column({ type: "jsonb", default: () => "'{}'", nullable: false })
  field_values!: FieldValueMap;

  @Column({ type: "varchar", length: 35, nullable: true })
  language!: string | null;

  @Index("idx_pdf_jobs_status")
  @Column({ type: "varchar", length: 50, default: "queued" })
  status!: "queued" | "running" | "completed" | "failed";

  @Column({ type: "varchar", length: 500, nullable: true })
  filename!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  template_content_hash!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  field_values_hash!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  rendered_content_hash!: string | null;

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
