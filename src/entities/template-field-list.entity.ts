import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "template_field_lists" })
@Index("ux_template_field_lists_tenant_list", ["tenant_uuid", "list_name"], {
  unique: true,
})
export class TemplateFieldListEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  tenant_uuid!: string;

  @Column({ type: "varchar", length: 255 })
  list_name!: string;

  @Column({ type: "jsonb", default: () => "'[]'" })
  values!: string[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
