import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule, InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('BOT_TOKEN') || '',
      }),
      inject: [ConfigService],
    }),
    BotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectBot() private readonly bot: Telegraf<any>) {}

  /**
   * Safe bootstrapping interceptor.
   * Wraps the Telegraf bot's launch procedure in a try-catch to ensure NestJS
   * survives startup failures (like 401 Unauthorized or network timeouts).
   */
  onModuleInit(): void {
    if (!this.bot) {
      return;
    }

    const originalLaunch = this.bot.launch.bind(this.bot);

    this.bot.launch = async (config?: any): Promise<void> => {
      try {
        console.log('[Bot] Intercepted startup: Launching Telegraf bot defensively...');
        return await originalLaunch(config);
      } catch (error) {
        console.error(
          '[Bot] CRITICAL startup failure caught safely: Failed to launch Telegraf bot! ' +
            'The server remains active, but moderation features will stay offline until a valid token is provided:',
          error,
        );
      }
    };
  }
}

