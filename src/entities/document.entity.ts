import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { PdfJobEntity } from "./pdf-job.entity";
import { TemplateEntity } from "./template.entity";

@Entity({ name: "documents" })
@Check(
  "ck_documents_status",
  `"status" IN ('draft', 'generated', 'published', 'archived')`,
)
export class DocumentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Index("idx_documents_template_id")
  @Column({ type: "uuid", nullable: true })
  template_id!: string | null;

  @ManyToOne(
    () => TemplateEntity,
    (template) => template.documents,
    {
      onDelete: "SET NULL",
    },
  )
  @JoinColumn({ name: "template_id" })
  template?: TemplateEntity | null;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  field_values!: Record<string, string | number | boolean | null>;

  @Index("idx_documents_status")
  @Column({ type: "varchar", length: 50, default: "draft" })
  status!: "draft" | "generated" | "published" | "archived";

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(
    () => PdfJobEntity,
    (job) => job.document,
  )
  pdf_jobs?: PdfJobEntity[];
}
