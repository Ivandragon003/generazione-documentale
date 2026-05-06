import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "audit_log" })
export class AuditLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  entity_type!: string;

  @Column({ type: "uuid" })
  entity_id!: string;

  @Column({ type: "varchar", length: 100 })
  action!: string;

  @Column({ type: "varchar", length: 255, default: "system" })
  actor!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}
