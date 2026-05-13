import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";

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

  @Column({ type: "jsonb", default: () => "'[]'" })
  fields!: FieldDefinition[];

  @Column({ type: "varchar", length: 255, default: "system" })
  created_by!: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  // ✅ Campo virtuale — non persistito nel DB, iniettato da hydrateContent()
  content?: string;
}
