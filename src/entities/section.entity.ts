import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { CategoryEntity } from "./category.entity";
import { TemplateEntity } from "./template.entity";

@Entity({ name: "sections" })
export class SectionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(
    () => CategoryEntity,
    (category) => category.sections,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "category_id" })
  category!: CategoryEntity;

  @RelationId((section: SectionEntity) => section.category)
  category_id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "integer", default: 0 })
  position!: number;

  @OneToMany(
    () => TemplateEntity,
    (template) => template.section,
  )
  templates?: TemplateEntity[];
}
