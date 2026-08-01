import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OpexModule } from './opex/opex.module';
import { DistrictModule } from './district/district.module';
import { GroupViewModule } from './group-view/group-view.module';
import { BackupRestoreModule } from './backup-restore/backup-restore.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    OpexModule,
    DistrictModule,
    GroupViewModule,
    BackupRestoreModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
