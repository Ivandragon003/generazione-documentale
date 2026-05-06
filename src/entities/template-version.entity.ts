import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { TemplateEntity } from "./template.entity";

@Entity({ name: "template_versions" })
@Unique("idx_template_versions_unique_version", ["template_id", "version"])
export class TemplateVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  template_id!: string;

  @ManyToOne(
    () => TemplateEntity,
    (template) => template.versions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "template_id" })
  template?: TemplateEntity;

  @Column({ type: "integer" })
  version!: number;

  @Column({ type: "varchar", length: 500, nullable: true })
  content_path!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  fields!: FieldDefinition[];

  @Column({ type: "varchar", length: 50 })
  status!: string;

  @Column({ type: "varchar", length: 100, default: "update" })
  action!: string;

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}
