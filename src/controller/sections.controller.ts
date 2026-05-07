import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SectionsService } from "../service/sections.service";

@ApiTags("sections")
@Controller("sections")
export class SectionsController {
  constructor(
    @Inject(SectionsService)
    private readonly sectionsService: SectionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista sezioni con categoria" })
  findAll() {
    return this.sectionsService.findAll();
  }
}
