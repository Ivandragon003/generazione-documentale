import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "audit_logs" })
export class AuditLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("idx_audit_logs_tenant_uuid")
  @Column({ type: "varchar", length: 64 })
  tenant_uuid!: string;

  @Index("idx_audit_logs_event_type")
  @Column({ type: "varchar", length: 120 })
  event_type!: string;

  @Column({ type: "varchar", length: 255, default: "system" })
  actor!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  template_id!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;
}
