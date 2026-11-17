import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@config/index';
import { DatabaseModule } from '@core/database/index';
import { HashingModule } from '@core/hashing/hashing.module';
import { RequestLoggingInterceptor } from '@core/interceptors/request-logging.interceptor';
import { JsonWebTokenModule } from '@core/jsonwebtoken/jwt.module';
import { LoggingModule } from '@core/logging/logging.module';
import { AuthModule } from '@features/auth/auth.module';
import { ConversationsModule } from '@features/conversations/conversations.module';
import { FriendsModule } from '@features/friends/friends.module';
import { MessagesModule } from '@features/messages/messages.module';
import { UsersModule } from '@features/users/users.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggingModule,
    HashingModule,
    JsonWebTokenModule,
    AuthModule,
    FriendsModule,
    ConversationsModule,
    MessagesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
