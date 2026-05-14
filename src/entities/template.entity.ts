import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";

@Entity({ name: "templates" })
@Index("ux_templates_content_path_not_null", ["content_path"], {
  unique: true,
  where: `"content_path" IS NOT NULL`,
})
export class TemplateEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  content_path!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  fields!: FieldDefinition[];

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  // Virtual field: not persisted in DB, injected by hydrateContent().
  content?: string;
}
