import {
  Check,
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
@Check("ck_categories_type", `"type" IN ('portfolio', 'programma', 'progetto')`)
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
