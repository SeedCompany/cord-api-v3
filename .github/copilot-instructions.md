# CORD API Development Guidelines

This document provides guidelines for developers working on the CORD API v3 project, a backend built with NestJS, GraphQL, and Neo4j/Gel, using NodeJS and Docker.

### Code Style

The project uses ESLint and Prettier for code formatting and linting:

- Run `yarn lint` to check and fix linting issues.
- Run `yarn format` to format code using Prettier.
- Enforce TypeScript strict mode (`tsconfig.json` with `strict: true`).

### GraphQL

The project uses NestJS with GraphQL (graphql-yoga):

- GraphQL schema is generated in `schema.graphql` via `yarn gel:gen`.
- Resolvers are defined in `*.resolver.ts` files in `src/components`.
- DTOs (Data Transfer Objects) are defined in `*.dto.ts` files.
- Only access properties defined in DTOs or interfaces.

### Database

The API is transitioning from Neo4j to Gel:

- Neo4j is used with the `cypher-query-builder` library for queries.
- Gel is the next-gen database replacing Neo4j.
- Create migrations with `yarn gel:migration` to update the database schema.
- Generate seed data with `yarn gel:seed` for testing or development.

### Project Structure

- `src/`: Source code
  - `src/common/`: Common utilities, decorators, and TypeScript interfaces.
  - `src/components/`: Feature-specific modules (e.g., `user`, `order`), containing resolvers, services, DTOs, and tests subfolders.
  - `src/core/`: Core functionality, such as database connections and GraphQL setup.
- `test/`: E2E tests
  - `test/utility/`: Test utilities (e.g., test app setup).
- `dbschema/`: Database schema definitions and migrations.

### Coding Standards

- Use single quotes for strings, 2 spaces for indentation.
- Prefer async/await for asynchronous operations.
- Use `const` for constants, minimize `let` usage (e.g., except in try/catch).
- Use destructuring for objects/arrays, template literals for strings.
- Follow SOLID principles for modular, reusable, maintainable code.
- Avoid code duplication, deeply nested statements, hard-coded values.
- Use constants/enums instead of magic numbers/strings.
- Avoid mutations:
  - Prefer `const` over `let`.
  - Use spread syntax (e.g., `{ ...object, foo: 'bar' }`) instead of modifying objects.
- Use strict TypeScript:
  - Define all object shapes in DTOs (`*.dto.ts`) or interfaces in `src/common`.
  - Use type guards for safe property access (e.g., `if ('foo' in obj)`).

### GraphQL Guidelines

- Define resolvers in `*.resolver.ts` with clear input/output types.
- Use DTOs for input validation and response shaping.
- Avoid overfetching; include only necessary fields in queries.

### Database Guidelines

- Write Cypher queries for Neo4j using `cypher-query-builder` for type safety.
- Create Gel migrations for schema changes (`yarn gel:migration`).
- Validate query results against defined DTOs or interfaces.
- Avoid direct database mutations outside services; encapsulate in `*.service.ts`.

### Tagged Comments

- Use `// ai tag` to mark code for reference:
  - `example`: Best practice or model code.
  - `edge-case`: Necessary deviation from standards.
  - `best-practice`: Adherence to coding standards.
  - `anti-pattern`: Code to avoid (pending refactor).
  - `todo`: Needs improvement or refactoring.
  - `workaround`: Temporary fix for a limitation.
  - `performance`: Optimized code.
  - `security`: Security-critical code.
  - `test`: Exemplary test case.
  - `type-safety`: Safe property access.
- Optionally add notes after the tag (e.g., `// ai example Type-safe resolver`).
- Search tags with `git grep "ai "` to collect examples.

## Project Structure

- Place GraphQL resolvers in `src/components/*/resolver.ts`.
- Place services in `src/components/*/service.ts`.
- Place DTOs in `src/components/*/dto/*.dto.ts`.
- Place interfaces in `src/common`.
- Place unit tests in `src/components/*/tests/*.spec.ts`.
- Place E2E tests in `test/*.e2e-spec.ts`.

## Coding Standards

- Use camelCase for variables/functions, PascalCase for classes/interfaces/DTOs, kebab-case for files/folders.
- Use single quotes, 2-space indentation, async/await, and `const` over `let`.
- Use strict TypeScript with DTOs (`*.dto.ts`) or interfaces (`src/common`).
