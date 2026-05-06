import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { SectionEntity } from "./section.entity";

export type CategoryType = "portfolio" | "programma" | "progetto";

@Entity({ name: "categories" })
@Unique("uq_categories_type_name", ["type", "name"])
export class CategoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 50 })
  type!: CategoryType;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @OneToMany(
    () => SectionEntity,
    (section) => section.category,
  )
  sections?: SectionEntity[];
}
