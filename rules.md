# Rules

Engineering rules for this codebase. These are **binding conventions**, not
suggestions. Follow them so the code stays consistent, testable, and easy to
reason about. When a rule must be broken, document why right where it is broken.

Companion docs: [`architecture.md`](./architecture.md) (how the system is
structured) and [`plan.md`](./plan.md) (the roadmap).

---

## 1. Configuration & environment

1. **Never read `process.env` outside `config/`.** Application code
   receives configuration through `ConfigService` or a namespaced config object.
   This keeps every env var typed, defaulted, and validated in one place.

   ```ts
   // ✅ good — inside a provider
   constructor(private readonly config: ConfigService) {
     this.secret = this.config.get<string>('jwt.secret');
   }

   // ❌ bad — scattered, untyped, unvalidated
   const secret = process.env.JWT_SECRET;
   ```

2. **Every environment variable is declared and validated.** Add the property to
   `EnvironmentVariables` in `config/env.validation.ts` with
   `class-validator` decorators. A missing or malformed value must **fail the app
   at boot**, never at request time.

3. **Expose config through namespaced factories** (`registerAs`) and register
   them in `config/config.module.ts`. Namespaces are lowercase and injected by key:
   `config.get('jwt.secret')`, `config.get('hashing.rounds')`,
   `config.get('swagger.path')`.

4. **Provide defaults in the schema**, so a fresh checkout runs. Required secrets
   without a safe default must have a `MinLength`/non-empty rule and a documented
   `.env.example` entry.

5. **Keep `.env.example` in sync.** Any new variable gets:
   - an entry in `EnvironmentVariables`,
   - a line in `.env.example`,
   - (optionally) a namespace factory.
   `.env` and `.env.development` hold local values and are not committed with
   secrets.

6. **`ConfigModule` is registered exactly once**, in `AppModule`, with
   `isGlobal: true`. Feature modules never call `ConfigModule.forRoot`.

7. **Environment files are loaded with `dotenv` in `main.ts`** (`bootstrapEnv`)
   before Nest boots, resolving `.env.<NODE_ENV>` first (defaulting to
   `development`) then `.env`. Real process env wins over file values. Do not
   load dotenv anywhere else.

---

## 2. API documentation (Swagger)

1. **Swagger is set up once**, in `main.ts`, via `setupSwagger(app, config)` from
   `utils/swagger`. Do not call `SwaggerModule` directly elsewhere.

2. **Document routes with the shared `@ApiEndpoint(...)` decorator** rather than
   stacking raw `@Api*` decorators. It records the summary, the standard error
   responses (matching `AppError`), and bearer auth in one place.

   ```ts
   @Post('register')
   @ApiEndpoint('Register a new user', { auth: false })
   register(@Body() body: RegisterRequestDto) { … }
   ```

3. **Keep request/response DTOs decorated** with `@ApiProperty` (or the Swagger
   CLI plugin) so the generated schema matches the real contract.

4. **Swagger is gated by config** (`SWAGGER_ENABLED`), disabled by default and in
   production. Never expose the docs publicly unless intended.

5. **The bearer scheme name is `access-token`** (`BEARER_AUTH`). Reference that
   constant for `@ApiBearerAuth(...)`.

---

## 3. Logging

1. **Winston is the only logging backend.** `LoggingModule` is global and wires
   the transports; `main.ts` uses `WinstonModule.createLogger` so even startup
   logs go through Winston. Do not add `console.log` or a second logger.

2. **Log through `LoggingService`**, never `winston` directly. It is
   `LoggerService`-compatible and exposes `log`, `debug`, `verbose`, `warn`, and
   `error`.

   ```ts
   constructor(private readonly logger: LoggingService) {
     this.logger.setContext(UserRegisterUsecase.name);
   }
   this.logger.log('user registered', { userId: user.id });
   this.logger.error('registration failed', error, { email: req.email });
   ```

3. **Always set a context** (`setContext(ClassName)` or `withContext()`) so logs
   are attributable.

4. **Log files are fixed:** `logs/combined.log` (all levels, JSON) and
   `logs/error.log` (errors only). File contents are gitignored; only the
   directory is tracked.

5. **Requests are logged in development.** In `development`, request data
   (method, url, body, query, params) **must** be logged via
   `RequestLoggingInterceptor` with `LOG_REQUESTS=true`. This is enabled by
   default in `.env.development`. In production set `LOG_REQUESTS=false` so
   bodies and secrets never reach disk.

6. **Never log secrets.** Passwords, tokens, and full request bodies containing
   credentials are never logged, at any level. Redact before logging.

7. **Log levels are configurable** (`LOG_LEVEL`, `LOG_FILE_LEVEL`,
   `LOG_ERROR_LEVEL`, `LOG_DIR`) — read via config, never `process.env`.

---

## 4. Usecases

1. **Every business action is a usecase** implementing
   `Usecase<Request, Data>` from `utils/usecase`. One action, one class, named
   `<Action><Entity>Usecase` (e.g. `UserRegisterUsecase`).

2. **A usecase always returns `Response<Data>` — never a bare value, never a
   thrown error for expected failures.**

   ```ts
   // ✅ good
   async execute(req: RegisterRequestDto): Promise<Response<UserResponseDto>> {
     if (await this.users.findByEmail(req.email)) {
       return failure<UserResponseDto>('EMAIL_ALREADY_EXISTS', 'Conflict', 'Email already in use');
     }
     const user = await this.users.create(req);
     return success<UserResponseDto>(toUserResponse(user));
   }

   // ❌ bad — ambiguous return, untracked failure mode
   async execute(req: RegisterRequestDto): Promise<UserResponseDto> { /* ... */ }
   ```

3. **Use `success(...)` and `failure(...)` helpers.** Do not hand-build the
   `{ success: true, data }` object literals — the helpers keep the union
   consistent.

4. **Expected failures use `failure(...)`; only truly exceptional, unrecoverable
   conditions may throw.** Validation/business errors (not found, conflict,
   unauthorized) are values, not exceptions.

5. **`Data` is a response DTO type**, defined in the feature's `response/`
   folder — not an entity, not `any`. This guarantees the HTTP contract is typed
   end to end.

6. **Usecases contain no HTTP concepts.** No `Request`/`Response` objects, no
   status codes from the transport, no `@Body()`/`@Query()`. They receive a
   typed request DTO and return a `Response<Data>`.

7. **Usecases never import other features' internals.** Reuse through an
   exported provider from `core`/`utils`, or move the shared concept into its own
   feature.

8. **Usecases depend on abstractions**: repositories and `core` services. They
   never touch a database driver or `bcrypt`/JWT libraries directly.

---

## 5. Requests & responses (DTOs)

1. **Every request input is a DTO class** in `features/<feature>/request/`, using
   `class-validator` decorators. No inline types, no `any`.

2. **Every response output is a DTO class** in `features/<feature>/response/`,
   using `class-transformer` `@Exclude()`/`@Expose()` to control exactly what
   leaves the app.

3. **Never leak internal fields.** Hashes, tokens, and internal ids are never
   `@Expose()`d. Prefer `@Exclude()` on the class and `@Expose()` on public
   fields, then map with `plainToInstance(Dto, entity, { excludeExtraneousValues: true })`.

4. **Expose only `public_id`, never the internal `id`.** Every table carries an
   internal surrogate key (`id`, `BIGSERIAL` or part of a composite key) for
   joins/FKs, plus a `public_id UUID` for clients. Repositories and DTOs use the
   internal `id` only for persistence; response DTOs map `public_id` to the
   client-facing identifier (conventionally the `id` field) and **never**
   serialize the numeric `id`. Request payloads and route params that reference
   a resource accept the public UUID. JWTs use the public UUID as `sub`.

   ```ts
   // ✅ good — internal id stays in the repository
   @Expose() id: string; // mapped from user.public_id

   // ❌ bad — leaks the database key
   @Expose() id: string; // mapped from user.id
   ```

5. **Validate at the boundary with `AppValidationPipe`.** The global pipe
   (`whitelist`, `forbidNonWhitelisted`, `transform`, `stopAtFirstError`) is
   registered in `main.ts`; rely on it rather than hand-checking in controllers.
   It **removes extra/unexpected elements** from the request and **rejects**
   them, and **stops at the first error per field**.

6. **Validation errors use the frontend-friendly body.** Never hand-roll a
   validation response — the pipe returns:

   ```json
   {
     "error": "Bad Request",
     "statusCode": "VALIDATION_ERROR",
     "message": "email: email must be an email",
     "details": [{ "field": "email", "message": "email must be an email" }]
   }
   ```

   `details[]` maps one entry per offending field (dotted for nested paths) so
   the frontend can attach each message to its input.

7. **Every DTO field carries a validator.** A property without a
   `class-validator` decorator is silently accepted; always add one (e.g.
   `@IsString()` on `password`).

8. **DTO naming:** request DTOs end in `.request.dto.ts`, response DTOs in
   `.response.dto.ts`, classes end in `...RequestDto` / `...ResponseDto`.

---

## 6. Errors

1. **All errors share the `AppError` contract** from `utils/errors`:
   `{ message, statusCode, error, details? }`.

2. **`statusCode` is a machine-readable, SCREAMING_SNAKE code** (e.g.
   `USER_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`), stable across releases. Clients may
   branch on it.

3. **`error` is the short label** (`Bad Request`, `Conflict`, `Unauthorized`);
   **`message` is the human-readable explanation.** Don't swap them.

4. **Errors flow through the `failure` branch of `Response<T>`** — do not throw
   for expected failures, and do not invent parallel error shapes.

5. **Validation errors may carry `details`** typed as `FieldError[]`
   (`ValidationError`), with `statusCode: 'VALIDATION_ERROR'`.

6. **Every failure is serialized into the `AppError` shape** by
   `HttpExceptionFilter` (HTTP exceptions, including `AppException`) or
   `AllExceptionsFilter` (unexpected errors). Never return ad-hoc error bodies
   from controllers; throw an `HttpException` (or a domain error) and let the
   filter format it. Unexpected errors are logged and returned as a generic
   `INTERNAL_SERVER_ERROR` — never leaking internals to the client.

---

## 7. Layering & dependencies

1. **Direction of dependencies:** `features` → `core` / `utils`. Nothing in
   `core` or `utils` imports from `features`.

2. **`utils` is framework-agnostic.** No NestJS decorators, no DI in `utils`.

3. **`core` is feature-agnostic.** Capabilities (crypto, hashing, JWT, config)
   know nothing about users, auth, or messages.

4. **Repositories are the only place that touches persistence.** Controllers and
   usecases never talk to a database driver.

5. **Controllers are thin:** validate (via DTOs) → call one usecase → map the
   `Response<Data>` to an HTTP reply. No business logic, no branching on domain
   rules.

6. **Features are sealed.** Cross-feature communication goes through exported
   providers or shared `core`/`utils` code.

---

## 8. Naming & file layout

1. **Files use kebab-case**; classes/interfaces use `PascalCase`.
2. **Feature folders are singular and lowercase**, matching the domain noun.
3. **Barrel `index.ts` per `core`/`utils` folder** to expose its public surface.
   Feature internals are imported by path — avoid deep barrels that hide coupling.
4. **`const`/helpers that are implementation details are not exported.**
5. **One primary export per file** unless the file is a grouped barrel.

---

## 9. TypeScript

1. **Strict types; no `any` in committed code.** Use `unknown` and narrow.
2. **No non-null assertion (`!`) to silence the compiler** — handle the `null`.
3. **Prefer `interface` for object contracts, `type` for unions/aliases.**
4. **Explicit return types on public methods** (services, usecases, utils).
5. **Use `import type` for type-only imports.**
6. **Decorators require `experimentalDecorators` + `emitDecoratorMetadata`**
   (already set in `tsconfig.json`) — do not change these.

---

## 10. Composition, modules & DI

1. **Global modules only for truly app-wide concerns** (`ConfigModule`,
   `JsonWebTokenModule`). Everything else is imported explicitly where used.
2. **Providers are singletons by default** — keep services stateless.
3. **Inject by constructor**, using `private readonly` fields.
4. **Register new feature modules in `AppModule`** as the single composition
   root.

---

## 11. Testing

1. **Every usecase has a unit test** covering its success and failure branches.
2. **Usecases are tested in isolation** with mocked repositories/`core` services.
3. **Repositories and external boundaries are mocked**, never hit real infra in
   unit tests.
4. **Test files live next to the code** as `*.spec.ts`.
5. **Tests assert on `Response<T>`** (`isSuccess` / `isFailure`) — the same
   contract production code uses.

---

## 12. Security

1. **Never log secrets, passwords, tokens, or full request bodies with
   credentials.** Log codes and ids, not sensitive payloads (see §3.6).
2. **Passwords are only ever hashed via `core/hashing`.** No plaintext storage,
   no home-grown hashing.
3. **Tokens are issued/verified only via `core/jsonwebtoken`.** `decode*` results
   are never trusted for authorization — use `verify`.
4. **Never commit `.env` with real secrets.** Use `.env.example` as the template.

---

## 13. Git & quality gates

1. **No commits that fail `pnpm build`, `pnpm lint`, or `pnpm test`.**
2. **Prettier + ESLint are authoritative** for formatting; run `pnpm format` /
   `pnpm lint` before committing.
3. **Keep commits focused** — one logical change per commit, message in the
   imperative mood.
4. **Update the docs** (`architecture.md`, this file) when a rule or structure
   changes.

---

## Quick checklist for a new feature

- [ ] `features/<name>/<name>.module.ts` + `<name>.controller.ts`
- [ ] `<name>/usecase/<action>.usecase.ts` implementing `Usecase<Request, Data>`
- [ ] `<name>/request/*.request.dto.ts` — every field has a `class-validator`
      decorator, plus `@ApiProperty`
- [ ] `<name>/response/*.response.dto.ts` with `class-transformer` + `@ApiProperty`
- [ ] `<name>/repository/*.entity.ts` + `*.repository.ts` (if persisting)
- [ ] Config vars added to `config/` + `.env.example` (no `process.env`)
- [ ] Response DTOs expose `public_id`, never the internal numeric `id`
- [ ] Endpoints documented with `@ApiEndpoint(...)`
- [ ] Logging via `LoggingService` with a context (no `console.log`)
- [ ] Errors thrown as `AppException` / `HttpException` (formatted by
      `HttpExceptionFilter`)
- [ ] New module registered in `app.module.ts`
- [ ] Unit tests for success + failure paths
- [ ] `pnpm build && pnpm lint && pnpm test` green
