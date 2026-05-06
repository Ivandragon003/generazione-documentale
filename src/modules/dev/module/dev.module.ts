import { Module } from "@nestjs/common";
import { DevController } from "../controller/dev.controller";
import { DevRepository } from "../repository/dev.repository";

@Module({
  controllers: [DevController],
  providers: [DevRepository],
})
export class DevModule {}
