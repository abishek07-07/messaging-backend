# Architecture

This document describes the architecture of the messaging backend. It is a
**NestJS** application built around **feature modules** and a **usecase
(interactor) pattern**. Each feature is a vertical slice: it owns its HTTP
transport, its usecases, its data contract, and its persistence — everything it
needs lives in one folder.

Two principles guide the layout:

1. **Features are self-contained.** A feature never reaches into another
   feature's internals. Shared behavior lives in `core/` or `utils/`.
2. **Transport is separated from behavior.** Controllers and DTOs deal with
   HTTP; usecases deal with business rules; repositories deal with storage.

---

## Layered overview

```
┌────────────────────────────────────────────────────────────┐
│  main.ts  ·  app.module.ts                                  │   Bootstrap
├────────────────────────────────────────────────────────────┤
│  features/<feature>/                                        │
│    auth.controller.ts     ← HTTP boundary (routes, DTOs)    │
│    usecase/*.usecase.ts   ← business logic (one per action) │
│    repository/*.ts        ← persistence (entity + repo)     │
│    request/  response/    ← data contract (DTOs)            │
│    <feature>.module.ts    ← wiring                          │
├────────────────────────────────────────────────────────────┤
│  core/        crypto · hashing · jsonwebtoken               │   Infrastructure
├────────────────────────────────────────────────────────────┤
│  utils/     usecase · errors · swagger                       │   Shared helpers
└────────────────────────────────────────────────────────────┘
```

Dependencies point **inward and downward**: a controller depends on usecases,
usecases depend on repositories and `core/` services, and everything may use
`utils/`. Nothing in `core/` or `utils/` depends on a feature.

---

## Directory structure

```
src/
├── main.ts                         # Bootstrap + global pipes
├── app.module.ts                   # Root module; imports feature modules
├── app.controller.ts               # Root controller (health/ping)
├── app.service.ts
│
├── core/                           # Infrastructure shared by all features
│   ├── config/                     # Typed, validated configuration
│   │   ├── config.module.ts        # ConfigModule (global) — loads + validates
│   │   ├── app.config.ts           # app namespace
│   │   ├── hashing.config.ts       # hashing namespace
│   │   ├── jwt.config.ts           # jwt namespace
│   │   ├── logging.config.ts       # logging namespace (re-exported)
│   │   ├── swagger.config.ts       # swagger namespace
│   │   ├── env.validation.ts       # EnvironmentVariables + validateEnv
│   │   └── index.ts
│   ├── crypto/                     # Encryption / signing primitives
│   │   └── index.ts
│   ├── decorators/                 # HTTP param decorators
│   │   └── current-user.decorator.ts   # @CurrentUser()
│   ├── filters/                    # Global exception filters
│   │   └── all-exceptions.filter.ts
│   ├── guards/                     # Route guards
│   │   └── jwt-auth.guard.ts       # Bearer token → request.user
│   ├── hashing/                    # Password / value hashing (bcryptjs)
│   │   └── index.ts                # HashingService
│   ├── interceptors/               # Cross-cutting HTTP interceptors
│   │   └── request-logging.interceptor.ts
│   ├── logging/                    # Winston logging (global)
│   │   ├── logging.module.ts       # LoggingModule (global)
│   │   ├── logging.service.ts      # LoggingService
│   │   └── logger.config.ts        # transports + formats
│   ├── pipes/                      # Global pipes
│   │   └── validation.pipe.ts      # AppValidationPipe
│   └── jsonwebtoken/               # Token issuing, verifying & decoding
│       ├── jwt.module.ts           # JsonWebTokenModule (global)
│       └── jwt.service.ts          # JsonWebTokenService
│
├── utils/                          # Framework-agnostic shared helpers
│   ├── usecase/                    # The usecase contract + response type
│   │   ├── index.ts                # Usecase<Request, Data> + re-exports
│   │   └── response.ts             # Response<T> union + success/failure
│   ├── errors/                     # Generic error contract
│   │   └── index.ts                # AppError<Details> / ErrorType
│   └── swagger/                    # OpenAPI setup + reusable decorators
│       ├── index.ts                # setupSwagger(app, config)
│       └── decorators.ts           # @ApiEndpoint, BEARER_AUTH
│
└── features/                       # One folder per business capability
    └── auth/
        ├── auth.module.ts
        ├── auth.controller.ts
        ├── request/                # Request DTOs (class-validator)
        ├── response/               # Response DTOs (class-transformer)
        ├── usecase/                # One usecase per action
        │   └── user-register.usecase.ts
        └── repository/             # Persistence
            ├── users.entity.ts
            └── users.repository.ts
```

> Folders are created only when needed. A read-only feature may have no
> `repository/`; a feature with no custom validation may have no `request/`.

---

## Feature anatomy (vertical slice)

Every feature follows the same shape. `auth` is the reference implementation.

| Path                     | Responsibility                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `<feature>.module.ts`    | Wires controller + usecases + repositories; imports `core` modules.   |
| `<feature>.controller.ts`| Declares routes, validates request DTOs, returns response DTOs.       |
| `usecase/*.usecase.ts`   | **One class per action.** Holds the business rules for that action.    |
| `request/*.dto.ts`       | Incoming data contract, validated with `class-validator`.             |
| `response/*.dto.ts`      | Outgoing data contract, shaped with `class-transformer`.              |
| `repository/*.entity.ts` | The persisted record shape.                                           |
| `repository/*.repository.ts` | Data-access methods, injected into usecases.                      |

A feature may expose more than one controller when it owns distinct resources.
The `friends` feature, for example, splits friend requests (`/friend-requests`)
from accepted friends and blocks (`/friends`) while sharing the same usecases
and repositories.

### The usecase pattern

The project does **not** use a single fat service per feature. Instead each
business action gets its own small, single-responsibility class — a **usecase** —
that implements the shared `Usecase` interface from `utils/usecase`.

```ts
// src/utils/usecase/index.ts
import type { Response } from './response';

export interface Usecase<Request, Data> {
  execute(request: Request): Promise<Response<Data>>;
}
```

`Response<T>` is a **discriminated union** on `success`, so callers narrow the
payload safely. It carries no HTTP concepts — mapping to a transport is the
caller's job.

```ts
// src/utils/usecase/response.ts
import type { AppError } from '../errors';

export type Response<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Response<T>;
export function failure<T = never, E = AppError>(
  error: E | ErrorType | string,
  message?: string,
  label?: string,
): Response<T, E>;

export function isSuccess<T, E>(r: Response<T, E>): r is { success: true; data: T };
export function isFailure<T, E>(r: Response<T, E>): r is { success: false; error: E };
```

Every error follows the generic `AppError` contract from `utils/errors`:

```ts
// src/utils/errors/index.ts
export interface AppError<Details = unknown> {
  message: string;      // human-readable description
  statusCode: string;   // machine-readable code, e.g. 'EMAIL_ALREADY_EXISTS'
  error: string;        // short label, e.g. 'Bad Request' / 'Conflict'
  details?: Details;    // optional structured context
}

export type ErrorType<Details = unknown> = AppError<Details>;
export type ValidationError = AppError<FieldError[]>;
```

This keeps behavioral units testable in isolation and readable at a glance:
`RegisterUserUsecase`, `LoginUsecase`, `GetConversationUsecase`, and so on.

```ts
// src/features/auth/usecase/user-register.usecase.ts
import { Injectable } from '@nestjs/common';
import { Usecase, Response, success, failure } from '../../../utils/usecase';
import { UsersRepository } from '../repository/users.repository';
import { RegisterRequestDto } from '../request/register.request.dto';
import { UserResponseDto } from '../response/user.response.dto';

@Injectable()
export class UserRegisterUsecase
  implements Usecase<RegisterRequestDto, UserResponseDto>
{
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(request: RegisterRequestDto): Promise<Response<UserResponseDto>> {
    const existing = await this.usersRepository.findByEmail(request.email);
    if (existing) {
      return failure<UserResponseDto>(
        'EMAIL_ALREADY_EXISTS',
        'Conflict',
        'That email is already registered',
      );
    }

    const user = await this.usersRepository.create(request);
    return success<UserResponseDto>({ id: user.id, email: user.email, displayName: user.displayName });
  }
}
```

### Request DTOs — `class-validator`

Request DTOs live in `features/<feature>/request/` and are plain classes with
validation decorators. A global `ValidationPipe` (registered in `main.ts`)
validates every incoming body, param, and query **before** the controller runs.

```ts
// src/features/auth/request/register.request.dto.ts
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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

### Response DTOs — `class-transformer`

Response DTOs live in `features/<feature>/response/`. They define exactly what a
client receives and use `class-transformer` to strip internal fields (hashes,
tokens, internal ids) when serializing.

```ts
// src/features/auth/response/user.response.dto.ts
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() displayName: string;
  // passwordHash is intentionally never exposed
}
```

Mapping an entity into a response DTO uses `plainToInstance` with
`excludeExtraneousValues: true` so only `@Expose()`d fields are emitted.

### Repository — persistence

Persistence is isolated behind a repository so usecases never talk to the
database driver directly.

- `<entity>.ts` — the persisted record's shape.
- `<repository>.ts` — an `@Injectable()` with data-access methods.

```ts
// src/features/auth/repository/users.repository.ts
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

---

## Core (infrastructure)

`src/core/` holds cross-cutting technical capabilities that features share. Each
capability is a **self-contained module** exposing a service through its
`index.ts`.

| Folder              | Concern                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `core/config`       | Typed, validated configuration (`ConfigModule`, namespaces).      |
| `core/crypto`       | Encryption, signing, and other low-level crypto primitives.      |
| `core/decorators`   | HTTP parameter decorators (`@CurrentUser()`).                    |
| `core/guards`       | Route guards (`JwtAuthGuard` verifies bearer access tokens).     |
| `core/hashing`      | One-way hashing for secrets such as passwords (`HashingService`).|
| `core/logging`      | Global Winston logging (`LoggingModule`, `LoggingService`).       |
| `core/interceptors` | Cross-cutting HTTP concerns (request logging).                    |
| `core/pipes`        | Global pipes (`AppValidationPipe`).                               |
| `core/filters`      | Global exception filters (`AllExceptionsFilter`).                 |
| `core/jsonwebtoken` | Issuing, verifying, and decoding JWTs (`JsonWebTokenService`).   |

`core` is deliberately **feature-agnostic**: it knows nothing about users, auth,
or messages. This makes each capability reusable and independently testable, and
lets features depend on a small, focused interface rather than a bundle of
unrelated helpers.

### `config/` — typed configuration

`ConfigModule` is registered **once**, in `AppModule`, with `isGlobal: true`. It
loads `.env.<NODE_ENV>` then `.env`, **validates** every variable with
`class-validator`, and exposes it through namespaced factories. Nothing outside
`config/` reads `process.env` (see [`rules.md`](./rules.md) §1).

```ts
// config/config.module.ts
NestConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  load: [appConfig, databaseConfig, hashingConfig, jwtConfig, loggingConfig, swaggerConfig],
  validate: validateEnv,      // fails boot on a bad/missing value
});
```

Namespaces are consumed via `ConfigService` with a dotted key:

```ts
config.get<number>('app.port');        // from appConfig
config.get<string>('jwt.secret');      // from jwtConfig
config.get<number>('hashing.rounds');  // from hashingConfig
```

`env.validation.ts` declares the full schema in `EnvironmentVariables`; add a
decorated property there for every new environment variable.

### `core/logging` — Winston

`LoggingModule` is **global** and registers Winston transports driven by the
`logging` config namespace. `LoggingService` is the single entry point for logs —
features never import `winston` directly.

| Transport              | Level       | Contents                       |
| ---------------------- | ----------- | ------------------------------ |
| console                | `LOG_LEVEL` | colourised, human-readable     |
| `logs/combined.log`    | `LOG_FILE_LEVEL` | every level, JSON         |
| `logs/error.log`       | `LOG_ERROR_LEVEL`| errors only, JSON         |

`LoggingService` is `LoggerService`-compatible and exposes the standard methods:

| Method                     | Level     |
| -------------------------- | --------- |
| `log(message, …meta)`      | info      |
| `debug(message, …meta)`    | debug     |
| `verbose(message, …meta)`  | verbose   |
| `warn(message, …meta)`     | warn      |
| `error(message, error?, …meta)` | error |

```ts
constructor(private readonly logger: LoggingService) {
  this.logger.setContext(UserRegisterUsecase.name);
}

this.logger.log('user registered', { userId: user.id });
this.logger.error('registration failed', error, { email: req.email });
```

Winston is also wired into `main.ts` (`WinstonModule.createLogger`) so **every**
framework log — including startup — goes through the same transports.

### `core/pipes` — `AppValidationPipe`

The global validation pipe. For every request DTO it:

- **removes extra elements** not declared on the DTO (`whitelist`),
- **rejects** requests that still carry them (`forbidNonWhitelisted`),
- **stops at the first error per field** (`stopAtFirstError`),
- returns a **frontend-friendly** error body.

```ts
// src/main.ts
app.useGlobalPipes(new AppValidationPipe());
```

On failure the response body is:

```json
{
  "error": "Bad Request",
  "statusCode": "VALIDATION_ERROR",
  "message": "email: email must be an email",
  "details": [{ "field": "email", "message": "email must be an email" }]
}
```

`details[]` carries one `{ field, message }` per offending field (nested paths are
dotted, e.g. `address.city`), so the frontend can map errors straight to inputs.

### `core/filters` — `AllExceptionsFilter`

Registered globally, it guarantees **one error shape for every failure** —
validation, HTTP exceptions, and unexpected errors alike — matching `AppError`.
It logs failures (warn for 4xx, error for 5xx) through `LoggingService` and
never leaks internals for unexpected errors.

```ts
// src/main.ts
app.useGlobalFilters(new AllExceptionsFilter(app.get(LoggingService)));
```

### `core/interceptors` — request logging

`RequestLoggingInterceptor` (registered globally via `APP_INTERCEPTOR`) logs each
HTTP request's method, url, status, and duration, and — when
`logging.logRequests` is enabled (development, `LOG_REQUESTS=true`) — the request
body, query, and params. In production the flag is off, so bodies and secrets
never reach the log files.

### `core/jsonwebtoken` — `JsonWebTokenService`

A thin, feature-agnostic wrapper over `@nestjs/jwt`. `JsonWebTokenModule`
registers the underlying `JwtModule` as **global** via `registerAsync`, reading
`jwt.secret` / `jwt.expiresIn` from `ConfigService` (not `process.env`), and
exports `JsonWebTokenService`, so features inject it without extra imports.

| Method                                       | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `signIn(payload)`                            | Sign a payload with the default options.            |
| `signInWithOptions(payload, options)`        | Sign with per-call options (expiry, secret, alg…).  |
| `verify<T>(token, options?)`                 | Verify signature + claims; throws if invalid.       |
| `decode<T>(token)`                           | Decode **without** verifying (payload only).        |
| `decodeWithOptions<T>(token, options)`       | Decode with options (`{ complete: true }` → header).|

```ts
// src/core/jsonwebtoken/jwt.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JsonWebTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signIn(payload: string | Buffer | JwtPayload): string {
    return this.jwtService.sign(payload as object);
  }

  verify<T extends JwtPayload = JwtPayload>(token: string, options?: JwtVerifyOptions): T {
    return this.jwtService.verify<T>(token, options);
  }

  decode<T = JwtPayload>(token: string): T | null {
    return this.jwtService.decode<T>(token);
  }
  // …signInWithOptions, decodeWithOptions
}
```

> `decode*` does **not** verify the signature. Never use its output for
> authorization on its own.

### `core/guards` + `core/decorators` — authentication

`JwtAuthGuard` reads `Authorization: Bearer <token>`, verifies it through
`JsonWebTokenService`, and attaches the caller to `request.user`:

```ts
export interface AuthenticatedUser {
  publicId: string;   // JWT sub — always the public UUID
  username?: string;
  email?: string;
}
```

Missing, malformed, expired, and invalid tokens all fail with the same
`UNAUTHORIZED` response. Protect controllers with `@UseGuards(JwtAuthGuard)` and
read the caller with `@CurrentUser()`:

```ts
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { … }
}
```

### `core/hashing` — `HashingService`

Password hashing built on `bcryptjs`. The cost factor comes from the `hashing`
config namespace (`HASH_ROUNDS`). All methods are async and run off the main
thread, so they never block the event loop.

| Method                       | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `hash(value, rounds?)`       | Hash a plaintext value into a salted bcrypt hash.   |
| `verify(value, hash)`        | Compare plaintext against a hash (returns boolean). |
| `genSalt(rounds?)`           | Generate a salt.                                    |
| `getRounds(hash)`            | Read the cost factor from an existing hash.         |

```ts
// usage inside a usecase
const passwordHash = await this.hashing.hash(request.password);
const ok = await this.hashing.verify(request.password, user.passwordHash);
```

Features import whatever `core` capability they need into their own module's
`imports` (global modules such as `JsonWebTokenModule` need no import).

---

## Utils (shared helpers)

`src/utils/` contains small, framework-agnostic building blocks shared across
features. Nothing here depends on NestJS DI or on a specific feature.

| Folder            | Purpose                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `utils/usecase`   | The `Usecase<Request, Data>` contract and the `Response<T>` type.   |
| `utils/errors`    | The generic `AppError` / `ErrorType` error contract.                |
| `utils/swagger`   | OpenAPI setup (`setupSwagger`) + reusable decorators.              |

`utils/usecase` is the backbone of the architecture: by standardizing the shape
of every usecase and its result, controllers, tests, and error handling all work
against one predictable contract. `utils/errors` defines the single error shape
(`AppError`) that flows through the failure branch of `Response<T>`.

### `utils/swagger` — API documentation

`setupSwagger(app, config)` builds the OpenAPI document and mounts the UI,
reading the `swagger` config namespace with per-call overrides. Called once in
`main.ts`.

| Route          | Serves                       |
| -------------- | ---------------------------- |
| `/{path}`      | Swagger UI (default `/docs`) |
| `/{path}-json` | OpenAPI JSON                 |
| `/{path}-yaml` | OpenAPI YAML                 |

A bearer (`access-token`) security scheme is registered automatically. Controllers
stay terse by using the shared `@ApiEndpoint(...)` decorator, which documents a
route's summary, error responses (matching `AppError`), and bearer auth in one
call:

```ts
@Post('register')
@ApiEndpoint('Register a new user', { auth: false })
register(@Body() body: RegisterRequestDto) {
  return this.userRegisterUsecase.execute(body);
}
```

---

## Request lifecycle

A single HTTP request flows through the system like this:

```
Client
  │  HTTP request
  ▼
Controller              features/<feature>/<feature>.controller.ts
  │  • route + HTTP method
  │  • @Body() typed as a request DTO
  ▼
AppValidationPipe       (global, registered in main.ts)
  │  • class-validator checks the request DTO
  │  • strips unknown fields, stops at first error
  │  • on failure → 400 { statusCode: 'VALIDATION_ERROR', details: [...] }
  ▼
Usecase                 features/<feature>/usecase/*.usecase.ts
  │  • applies business rules
  │  • calls repositories / core services
  ▼
Repository              features/<feature>/repository/*.repository.ts
  │  • reads / writes the entity
  ▼
Usecase (returns Response<T>)
  ▼
Controller (maps to response DTO)
  │  • class-transformer strips private fields
  ▼
Client
  │  JSON response
  │  (any failure → AllExceptionsFilter → one AppError-shaped body)
```

---

## Bootstrapping

`main.ts` assembles the global concerns so features stay lean. It first loads
environment files with `dotenv` (§ `core/config`), then boots Nest, wires the
global `AppValidationPipe` and `AllExceptionsFilter`, mounts Swagger, and listens
on the configured port:

```ts
// src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { buildLoggerOptions } from './core/logging/logger.config';
import { setupSwagger } from './utils/swagger';

/** Load `.env.<NODE_ENV>` then `.env` before Nest reads configuration. */
function bootstrapEnv() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  loadEnv({ path: [`.env.${nodeEnv}`, '.env'] });
}

async function bootstrap() {
  bootstrapEnv();

  // Winston from the first log line (startup included).
  const logger = WinstonModule.createLogger(buildLoggerOptions());

  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get(ConfigService);

  // Strip unknown fields, fail on the first error, frontend-friendly body.
  app.useGlobalPipes(new AppValidationPipe());

  // One consistent error shape for every failure.
  app.useGlobalFilters(new AllExceptionsFilter(app.get(LoggingService)));

  setupSwagger(app, config);      // serves /docs, /docs-json, /docs-yaml

  await app.listen(config.get<number>('app.port') ?? 3000);
}
void bootstrap();
```

Values already present in the process environment win over file values, so real
deployment secrets are never overridden by a committed `.env`.

`app.module.ts` is the composition root: it imports `ConfigModule` (global),
then each feature module, and feature modules import the `core` capabilities
they depend on.

```ts
// src/app.module.ts
@Module({
  imports: [ConfigModule, LoggingModule, JsonWebTokenModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
```

```ts
// src/features/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserRegisterUsecase } from './usecase/user-register.usecase';
import { UsersRepository } from './repository/users.repository';
import { HashingService } from '../../core/hashing';

@Module({
  controllers: [AuthController],
  providers: [UserRegisterUsecase, UsersRepository, HashingService],
  exports: [UserRegisterUsecase],
})
export class AuthModule {}
```

---

## Dependency rules

To keep the architecture healthy:

1. **Features never import other features' internals.** Cross-feature needs go
   through an exported provider or move into `core`/`utils`.
2. **`core` and `utils` never import from `features`.** They are leaves.
3. **Controllers contain no business logic** — they validate, delegate to a
   usecase, and shape the response.
4. **Usecases contain no HTTP concerns** — no `Request`/`Response`, no status
   codes baked into transport details beyond the `Response<T>` contract.
5. **Repositories are the only place that touchs persistence.**
6. **Data contracts live in `request/` and `response/`**, never inline in
   controllers.

---

## Adding a new feature

1. Create `src/features/<feature>/` with `<feature>.module.ts` and
   `<feature>.controller.ts`.
2. For each action, add `usecase/<action>.usecase.ts` implementing
   `Usecase<Request, Data>`.
3. Add `request/*.dto.ts` classes (with `class-validator`) for every input.
4. Add `response/*.dto.ts` classes (with `class-transformer`) for every reply.
5. Add `repository/*.entity.ts` and `repository/*.repository.ts` if data is
   persisted.
6. Import any required `core` capability into the feature module.
7. Register the feature module in `app.module.ts`.

---

## Toolchain

- **Framework:** NestJS 11
- **Configuration:** `@nestjs/config` (typed + validated in `core/config`)
- **Validation:** `class-validator`
- **Transformation / serialization:** `class-transformer`
- **JWT:** `@nestjs/jwt` (wrapped by `core/jsonwebtoken`)
- **Password hashing:** `bcryptjs` (wrapped by `core/hashing`)
- **Auth primitives:** `core/crypto`, `core/hashing`, `core/jsonwebtoken`
- **Logging:** `winston` + `nest-winston` (global `core/logging`)
- **Docs:** `@nestjs/swagger` (setup + decorators in `utils/swagger`)
- **Language:** TypeScript 5.7 (decorators enabled)
- **Package manager:** pnpm
- **Tests:** Jest (`*.spec.ts` unit tests; `test/` for e2e)

---

## Conventions

The binding engineering rules that keep this architecture healthy live in
[`rules.md`](./rules.md). Notably: configuration is never read from
`process.env` outside `core/config`, and every usecase returns a typed
`Response<Data>`.
