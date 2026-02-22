import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OpexModule } from './opex/opex.module';
import { DistrictModule } from './district/district.module';
import { GroupViewModule } from './group-view/group-view.module';

@Module({
  imports: [PrismaModule, UserModule, AuthModule, OpexModule, DistrictModule, GroupViewModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
