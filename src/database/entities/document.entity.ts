import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { DocumentVersionEntity } from "./document-version.entity";
import { PdfJobEntity } from "./pdf-job.entity";
import { TemplateEntity } from "./template.entity";

@Entity({ name: "documents" })
export class DocumentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "uuid", nullable: true })
  template_id!: string | null;

  @ManyToOne(
    () => TemplateEntity,
    (template) => template.documents,
    { onDelete: "SET NULL" },
  )
  @JoinColumn({ name: "template_id" })
  template?: TemplateEntity | null;

  @Column({ type: "integer" })
  template_version!: number;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", default: () => "'{}'"
  })
  field_values!: Record<string, string | number | boolean | null>;

  @Column({ type: "varchar", length: 50, default: "draft" })
  status!: "draft" | "generated" | "published" | "archived";

  @Column({ type: "integer", default: 1 })
  version!: number;

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(
    () => DocumentVersionEntity,
    (version) => version.document,
  )
  versions?: DocumentVersionEntity[];

  @OneToMany(
    () => PdfJobEntity,
    (job) => job.document,
  )
  pdf_jobs?: PdfJobEntity[];
}
