import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { DocumentEntity } from "./document.entity";

@Entity({ name: "templates" })
@Check("ck_templates_status", `"status" IN ('draft', 'published')`)
export class TemplateEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  content_path!: string | null;

  @Index("idx_templates_status")
  @Column({ type: "varchar", length: 50, default: "draft" })
  status!: "draft" | "published";

  @Column({ type: "jsonb", default: () => "'[]'" })
  fields!: FieldDefinition[];

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(
    () => DocumentEntity,
    (document) => document.template,
  )
  documents?: DocumentEntity[];

  // ✅ Campo virtuale — non persistito nel DB, iniettato da hydrateContent()
  content?: string;
}
