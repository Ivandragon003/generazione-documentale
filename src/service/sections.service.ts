import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { SectionEntity } from "../entities/section.entity";

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(SectionEntity)
    private readonly sectionRepository: Repository<SectionEntity>,
  ) {}

  async findAll() {
    return this.sectionRepository.find({
      relations: { category: true },
      order: {
        position: "ASC",
        name: "ASC",
      },
    });
  }
}
