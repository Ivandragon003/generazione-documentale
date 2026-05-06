import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { DocumentEntity } from "./document.entity";

@Entity({ name: "document_versions" })
@Unique("idx_document_versions_unique_version", ["document_id", "version"])
export class DocumentVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  document_id!: string;

  @ManyToOne(
    () => DocumentEntity,
    (document) => document.versions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "document_id" })
  document?: DocumentEntity;

  @Column({ type: "integer" })
  version!: number;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  field_values!: Record<string, string | number | boolean | null>;

  @Column({ type: "varchar", length: 100, default: "update" })
  action!: string;

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}
