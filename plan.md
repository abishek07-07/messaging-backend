# Backend Architecture Plan

A NestJS **messaging** backend organized by **feature**. Every feature owns its own
controller, service, request/response DTOs, and repository so that logic stays
close together and features can be added or removed independently.

Two libraries drive the data contract at the HTTP boundary:

- **`class-validator`** validates **requests** — incoming request bodies, params,
  and queries are declared as classes and checked before they ever reach a service.
- **`class-transformer`** shapes **responses** — entities and internal objects are
  converted into safe, typed response DTOs (and stripped of anything the client
  should not see) via `plainToInstance` / `instanceToPlain`.

---

## High-level structure

```
src/
├── main.ts                     # Bootstrap: global validation pipe, etc.
├── app.module.ts               # Root module, imports every feature module
├── app.controller.ts
├── app.service.ts
│
├── core/                       # Cross-cutting app infrastructure (no feature logic)
│   ├── config/                 # Env/config loading & validation
│   ├── filters/                # Global exception filters
│   ├── interceptors/           # Response serialization / logging interceptors
│   ├── middleware/             # Auth, request-id, logging middleware
│   ├── decorators/             # Custom decorators (e.g. @CurrentUser)
│   ├── guards/                 # Auth / role guards
│   └── pipes/                  # Shared custom pipes
│
├── utils/                      # Framework-agnostic helpers (pure functions)
│   ├── password.util.ts
│   ├── token.util.ts
│   └── pagination.util.ts
│
└── features/                   # One folder per business feature
    ├── auth/
    ├── users/
    ├── conversations/
    ├── messages/
    └── ...
```

The rule of thumb:

| Layer      | Purpose                                                       |
| ---------- | ------------------------------------------------------------- |
| `core/`    | App-wide plumbing shared by all features (guards, filters…).  |
| `utils/`   | Pure helper functions with no NestJS or feature knowledge.    |
| `features/`| Business capabilities. Self-contained and independently wired.|

---

## Feature anatomy

Each feature follows the **same internal layout**. Using `auth` as the reference:

```
src/features/auth/
├── auth.module.ts              # Wires controllers + providers + imports
├── auth.controller.ts          # HTTP endpoints; uses request DTOs
├── auth.service.ts             # Business logic; returns entities/domain objects
│
├── dto/                        # Data Transfer Objects at the HTTP boundary
│   ├── request/                # Validated with class-validator
│   │   ├── login.request.dto.ts
│   │   └── register.request.dto.ts
│   └── response/               # Shaped with class-transformer
│       ├── login.response.dto.ts
│       └── register.response.dto.ts
│
└── repository/                 # Persistence: entities + data access
    ├── users.entity.ts
    └── users.repository.ts
```

> Not every feature needs every folder. A read-only feature may have no
> `repository/`; a feature with no custom DTOs may omit `dto/`. Add folders only
> when the feature needs them.

### Responsibilities

- **Controller** (`*.controller.ts`)
  - Declares routes and extracts data (`@Body()`, `@Param()`, `@Query()`).
  - Types each input with a **request DTO** so the global `ValidationPipe`
    validates and transforms it automatically.
  - Delegates all work to the service and returns a **response DTO**.

- **Service** (`*.service.ts`)
  - Holds business logic and orchestrates repositories/other services.
  - Returns entities or plain domain objects — never raw HTTP concerns.

- **DTOs** (`dto/`)
  - `dto/request/` classes are the **only** place request data is typed. They are
    consumed by controllers and validated by `class-validator`.
  - `dto/response/` classes define exactly what the client receives. Entities are
    mapped into them, typically with `class-transformer`.

- **Repository** (`repository/`)
  - `*.entity.ts` — the persisted shape of a record.
  - `*.repository.ts` — data-access methods (find, create, update…), injected
    into services. Keeps persistence details out of business logic.

---

## Requests: validation with `class-validator`

Request DTOs live in `features/<feature>/dto/request/`. They are plain classes
decorated with `class-validator` rules. Because `emitDecoratorMetadata` and
`experimentalDecorators` are enabled in `tsconfig.json`, Nest can read the types
and apply the global `ValidationPipe`.

```ts
// features/auth/dto/request/login.request.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

```ts
// features/auth/dto/request/register.request.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterRequestDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName: string;
}
```

### Enabling validation globally

`main.ts` registers a global `ValidationPipe` so every request DTO is validated
without per-route boilerplate. It also transforms payloads into DTO instances and
whitelists unknown properties.

```ts
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip properties not in the DTO
      forbidNonWhitelisted: true, // reject requests with unknown properties
      transform: true,            // convert payloads into DTO class instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

The controller simply names the DTO type:

```ts
// features/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/request/login.request.dto';
import { RegisterRequestDto } from './dto/request/register.request.dto';
import { AuthResponseDto } from './dto/response/auth.response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterRequestDto): Promise<AuthResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginRequestDto): Promise<AuthResponseDto> {
    return this.authService.login(body);
  }
}
```

---

## Responses: shaping with `class-transformer`

Response DTOs live in `features/<feature>/dto/response/`. They describe the exact
public shape of a reply and are usually built from an entity using
`class-transformer`. This keeps internal fields (hashed passwords, tokens,
internal ids) out of the API while giving clients a typed contract.

```ts
// features/auth/dto/response/auth.response.dto.ts
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AuthResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  user: UserResponseDto;
}
```

```ts
// features/users/dto/response/user.response.dto.ts
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  displayName: string;

  // password is intentionally never exposed
}
```

The service converts entities into response DTOs with `plainToInstance`, so the
`@Exclude`/`@Expose` rules actually run:

```ts
// features/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { RegisterRequestDto } from './dto/request/register.request.dto';
import { AuthResponseDto } from './dto/response/auth.response.dto';
import { UserResponseDto } from '../users/dto/response/user.response.dto';

@Injectable()
export class AuthService {
  async register(body: RegisterRequestDto): Promise<AuthResponseDto> {
    // ...create the user via the repository...
    const user = { id: '1', email: body.email, displayName: body.displayName };

    return {
      accessToken: 'signed-token',
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async login(_body: LoginRequestDto): Promise<AuthResponseDto> {
    // ...verify credentials...
    return null as unknown as AuthResponseDto;
  }
}
```

> `excludeExtraneousValues: true` tells `class-transformer` to emit **only**
> `@Expose()`-d fields, guaranteeing nothing internal leaks into the payload.

### Optional: serialize automatically with an interceptor

Instead of calling `plainToInstance` in each service, a global interceptor can
serialize any response that is (or contains) a response DTO. `ClassSerializerInterceptor`
already does this for classes that extend nothing special:

```ts
// core/interceptors/serializer.interceptor.ts
import { ClassSerializerInterceptor, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';

export const SerializerInterceptorProvider: Provider = {
  provide: APP_INTERCEPTOR,
  useClass: ClassSerializerInterceptor,
};
```

Register it in `AppModule` (or globally in `main.ts`) and controllers can simply
return response DTO instances; serialization happens on the way out.

---

## The `repository/` layer

Each feature keeps persistence concerns isolated:

```ts
// features/auth/repository/users.entity.ts
export class UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// features/auth/repository/users.repository.ts
import { Injectable } from '@nestjs/common';
import { UserEntity } from './users.entity';

@Injectable()
export class UsersRepository {
  async findByEmail(_email: string): Promise<UserEntity | null> {
    return null;
  }

  async create(_data: Partial<UserEntity>): Promise<UserEntity> {
    return {} as UserEntity;
  }
}
```

Services depend on repositories; controllers never touch them directly.

---

## Wiring a feature

```ts
// features/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './repository/users.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersRepository],
  exports: [AuthService],
})
export class AuthModule {}
```

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './features/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## Adding a new feature (checklist)

1. Create `src/features/<name>/` with `<name>.module.ts`, `<name>.controller.ts`,
   `<name>.service.ts`.
2. Add `dto/request/*.request.dto.ts` classes for every input, using
   **`class-validator`** decorators.
3. Add `dto/response/*.response.dto.ts` classes for every reply, using
   **`class-transformer`** `@Exclude()`/`@Expose()`.
4. Add `repository/*.entity.ts` and `repository/*.repository.ts` if the feature
   persists data.
5. Register the module in `app.module.ts`.
6. Return response DTO instances from the controller/service so serialization and
   validation stay consistent across the app.

---

## Toolchain

- **Framework:** NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- **Validation:** `class-validator` (+ `class-transformer` for transforms)
- **Language:** TypeScript 5.7, decorators enabled (`experimentalDecorators`,
  `emitDecoratorMetadata`)
- **Package manager:** pnpm
- **Tests:** Jest (`*.spec.ts` unit tests under `src/`, `test/` for e2e)

> Dependencies to install when implementing the DTO layer:
>
> ```bash
> pnpm add class-validator class-transformer
> ```
```
