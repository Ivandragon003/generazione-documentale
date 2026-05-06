import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { FieldDefinition } from "../../common/types/field-definition.type";
import { DocumentEntity } from "./document.entity";
import { TemplateVersionEntity } from "./template-version.entity";

@Entity({ name: "templates" })
export class TemplateEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  content_path!: string | null;

  @Column({ type: "varchar", length: 50, default: "draft" })
  status!: "draft" | "published";

  @Column({ type: "integer", default: 1 })
  version!: number;

  @Column({ type: "jsonb", default: () => "'[]'" })
  fields!: FieldDefinition[];

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(
    () => TemplateVersionEntity,
    (version) => version.template,
  )
  versions?: TemplateVersionEntity[];

  @OneToMany(
    () => DocumentEntity,
    (document) => document.template,
  )
  documents?: DocumentEntity[];
}
