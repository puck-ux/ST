# Test Plan

This plan turns the requirements in `LO1_Requirements.md` into concrete test cases, says in what order they are built, and records how the plan changed as testing found defects. The Status column is updated as tests are written; the changelog at the end records every change to the plan.

**Status key:** Done (test exists and runs) · Planned (not written yet) · RED (written, currently failing because of a known defect)

---

## 1. Approach and order of work

Testing follows a test-driven cycle for defects: write a test from the requirement, run it, and if it fails because of a defect, commit it as RED, fix the code in a separate commit, then confirm it goes GREEN. Defects not fixed stay documented as known failures.

Tests are built from the bottom up, so that failures higher up can be trusted:

1. **Unit** (`__tests__/unit/`): models and the auth middleware. Fast, no server, isolate single components.
2. **Integration** (`__tests__/integration/`): routes + auth + an in-memory MongoDB, through supertest. Produces the coverage figures.
3. **System** (`__tests__/api/`): the original black-box suite against a running server, fixed so its negative tests can fail.
4. **Performance** (`__tests__/performance/`): Artillery runs against a running server.
5. **Static analysis and review**: ESLint and a checklist review (R-Q1).

Security requirements (R-S2, R-S3, R-S4, R-S5) are prioritised within each level, because they carry the highest risk: one user acting on another user's data.

---

## 2. Requirement → test traceability

| Req | Level | Technique | Test file | No. of cases | Status |
| --- | --- | --- | --- | --- | --- |
| R-U1 | Unit | Equivalence partitioning, boundary values | `unit/models.test.js` | 10 | Done |
| R-U2 | Unit | Test doubles (mocks/stubs) | `unit/auth.test.js` | 6 | Planned |
| R-U3 | Unit | Category-partition (simple form) | `unit/models.test.js` | 11 | Done |
| R-U4 | Unit | Equivalence partitioning | `unit/models.test.js` | 6 | Done |
| R-I1 | Integration | Scenario testing | `integration/users.test.js` | 2 | Planned |
| R-I2 | Integration | State-based testing | `integration/orders.test.js` | 7 | Planned |
| R-I3 | Integration | Negative testing, boundary values, property-based | `integration/orders.test.js`, `integration/robustness.property.test.js` | 8 + 2 properties | Planned |
| R-S1 | System | Table-driven black-box | `integration/access-control.test.js` | 1 per protected route | Planned |
| R-S2 | System | Decision table | `integration/access-control.test.js` | 12 | 10 Done, 2 RED (F1) |
| R-S3 | System | Negative testing | `integration/users.test.js` | 3 | Planned |
| R-S4 | System | Two-user scenarios | `integration/orders.test.js` | 4 | Planned |
| R-S5 | System | Response inspection | `integration/users.test.js` | 5 | Planned |
| R-S6 | System | Black-box | `api/api.users-admin.test.js`, matrix | 2 | 1 Done, 1 Planned |
| R-P1 | System | Load testing + statistics | `performance/performance-test.yml` | 5 runs | Planned |
| R-P2 | System | Load testing + statistics | `performance/performance-test.yml` | 5 runs | Planned |
| R-Q1 | Code | Static analysis, checklist review | `npm run lint`, `LO5_Review.md` | — | Planned |

---

## 3. Test cases

### R-U1 — Email validation (equivalence partitioning + boundaries)

| Partition | Example | Expected |
| --- | --- | --- |
| Shortest valid (boundary) | `a@b.c` | accepted |
| Typical valid | `jon.smith@ed.ac.uk` | accepted |
| Uppercase | `JON@ED.AC.UK` | accepted (stored lowercase) |
| Surrounding spaces | `  jon@ed.ac.uk  ` | accepted (trimmed) |
| No `@` | `jonexample.com` | rejected |
| No dot in domain | `jon@example` | rejected |
| Nothing before `@` | `@example.com` | rejected |
| Space inside | `jon smith@example.com` | rejected |
| Two `@` | `jon@@example.com` | rejected |
| Empty | `""` | rejected |

### R-U2 — Auth middleware (test doubles)

`req`, `res` and `next` are mocks; `User.findOne` is stubbed.

| Case | Input | Stub returns | Expected |
| --- | --- | --- | --- |
| 1 | No `Authorization` header | — | `res.sendStatus(401)`, `next` not called |
| 2 | `Bearer` with no token | — | 401, `next` not called |
| 3 | Token signed with the wrong secret | — | 403, `next` not called |
| 4 | Expired token | — | 403, `next` not called |
| 5 | Valid token, user deleted | `null` | 403, `next` not called |
| 6 | Valid token, user exists | `{ role: "Admin" }` | `req.user` has id + role `Admin`, `next` called once |

### R-U3 — User model (category-partition, one category per field)

Start from a fully valid user; vary one field at a time.

| Category | Choices tested | Expected |
| --- | --- | --- |
| name / email / password / address | present · missing | missing → rejected |
| role | `User` · `Admin` · `admin` · `SuperUser` · `""` · not given | first two accepted, next three rejected, not given → defaults to `User` |

### R-U4 — Order model (equivalence partitioning)

| Partition | Example | Expected |
| --- | --- | --- |
| Valid | `Box1`, `Box2` | accepted |
| Near-miss invalid | `Box3`, `box1`, `""` | rejected |
| Not given | — | defaults to `Box1` |

### R-I1 — Login token accepted (scenario)

1. Register → 201. 2. Login → 200 with `accessToken`. 3. `GET /me` with that token → 200 and the same email.
Second case: a token signed with another secret is refused by `GET /me` (403).

### R-I2 — Order lifecycle (state-based)

States: **No order** and **Exists**. Coverage criteria: all states, all transitions, and invalid transitions.

| # | State | Action | Expected | New state |
| --- | --- | --- | --- | --- |
| 1 | No order | `POST /order` | 201, stored in DB | Exists |
| 2 | Exists | `GET /order/:id` | 200, matches DB | Exists |
| 3 | Exists | `PUT /order` (type → Box2) | 200, DB shows Box2 | Exists |
| 4 | Exists | `DELETE /order/:id` | 200, gone from DB | No order |
| 5 | No order | `GET /order/:id` | 404 | No order |
| 6 | No order | `PUT /order` | 404 (F9: currently 400) | No order |
| 7 | No order | `DELETE /order/:id` | 404 (F9: currently 400) | No order |

### R-I3 — Robustness (negative, boundary, property-based)

| Case | Input | Expected |
| --- | --- | --- |
| ID 23 chars | `00000000000000000000000` | 400 |
| ID 24 chars, unknown | `000000000000000000000000` | 404 |
| ID 25 chars | `0000000000000000000000000` | 400 |
| ID non-hex | `00000000000000000000000g` | 400 |
| Empty body on `POST /register` | `{}` | 400 |
| Login, no password | `{ email }` | 400, server still answers `GET /` (F7) |
| Login, no email | `{ password }` | 400 or 404 |
| Delete unknown user (admin) | `000000000000000000000000` | 404 (F10: currently 400) |

**Properties (fast-check, 200 generated inputs each):**
- P1: for any JSON object sent to `POST /order`, `POST /register` or `PUT /me`, the status is below 500 and `GET /` still returns 200.
- P2: for any body without a top-level `role` key sent to `PUT /me` by a User, that user's role is still `User` afterwards (targets F2).

### R-S1 — No token → 401 (table-driven)

One row per protected route (11 routes): `GET /me`, `PUT /me`, `GET /users`, `GET /user/:id`, `DELETE /user/:id`, `POST /order`, `GET /orders/all`, `GET /order/:id`, `PUT /order`, `DELETE /order/:id`, `GET /orders/user/:id`. Each without a header → 401.

### R-S2 — Access control (decision table)

| Endpoint | Caller | Target | Expected | Status |
| --- | --- | --- | --- | --- |
| `GET /users` | User | — | 403 | Done |
| `GET /users` | Admin | — | 200 | Done |
| `GET /user/:id` | User | other user | 403 | Done |
| `GET /user/:id` | Admin | other user | 200 + **that** user's email | RED (F1) |
| `GET /user/:id` | Admin | unknown id | 404 | RED (F1) |
| `GET /orders/user/:id` | User | other user | 403 | Done |
| `GET /orders/user/:id` | Admin | other user | 200 | Done |
| `GET /order/:id` | User | other's order | 403 | Done |
| `GET /order/:id` | Admin | other's order | 200 | Done |
| `DELETE /order/:id` | User | other's order | 403 | Done |
| `DELETE /user/:id` | User | other user | 403 | Done |
| `DELETE /user/:id` | Admin | normal user | 200 | Done |

### R-S3 — No privilege escalation (negative)

| Case | Action | Expected afterwards |
| --- | --- | --- |
| 1 | `POST /register` with `role: "Admin"`, then login | `GET /users` → 403 (F4) |
| 2 | `PUT /me` with `{ role: "Admin" }` | 403 on the PUT, role still `User` |
| 3 | `PUT /me` with `{ "$set": { "role": "Admin" } }` | role still `User`, `GET /users` → 403 (F2) |

### R-S4 — Order ownership (two users, A and B)

| Case | Action by A on B's order | Expected |
| --- | --- | --- |
| 1 | `GET /order/:id` | 403 |
| 2 | `PUT /order` | 403, B's order unchanged in DB |
| 3 | `DELETE /order/:id` | 403, order still exists |
| 4 | A sets `user: B.id` on A's own order | rejected, or owner stays A (F11) |

### R-S5 — No password hashes exposed

Check that `password` is absent from the response body of: `POST /register`, `GET /me`, `GET /users`, `GET /user/:id` (4 cases, F5). Fifth case: change password with `PUT /me`, then log in with the new password → 200, and the stored value starts with `$2` (bcrypt) (F6).

### R-S6 — Admin cannot delete admin

| Case | Expected |
| --- | --- |
| Admin deletes a normal user | 200 (matrix row, Done) |
| Admin deletes another admin | 403 (fix the vacuous existing test, T1) |

### R-P1 / R-P2 — Performance

| Req | Scenario | Load | Pass condition | Runs |
| --- | --- | --- | --- | --- |
| R-P1 | `GET /` | 10 req/s for 60 s | p95 < 50 ms | 5; report mean p95 ± 95% CI |
| R-P2 | register → login → create/read/update/delete order | 10 arrivals/s for 60 s | p95 < 300 ms, 0% errors | 5; report mean p95 ± 95% CI |

Before running, fix the script's wrong routes (T6): `/users/register` → `/register`, `/users/login` → `/login`, `/orders` → `/orders/all`.

---

## 4. Instrumentation

| Instrument | What it records | Why it is needed | Status |
| --- | --- | --- | --- |
| Jest coverage (Istanbul) | Statement, branch, function and line coverage per file; HTML + Cobertura reports in `coverage/` | Shows which code the tests never reach; required to measure test adequacy (LO3) | Done |
| JUnit XML reporter | Per-test pass/fail in `reports/` | Lets CI display test results per run | Done |
| Request-timing middleware (`LOG_REQUESTS=1`) | One JSON line per request: method, path, status, duration in ms, user id | Separates server time from network time when analysing R-P1/R-P2 | Planned |
| Stryker mutation testing | Which deliberate code changes the tests catch (mutation score) | Measures whether tests check results, not just run code | Done (config) |
| Artillery JSON output | Latency percentiles and error counts per run | Raw data for the R-P1/R-P2 statistics | Planned |
| CPU profile (`node --cpu-prof`) | Where CPU time goes during the login flow | Explains R-P2 results (expected: bcrypt dominates) | Planned |

---

## 5. Evaluation of the plan (2.2)

*Fill in once most tests exist. Starting points:*

- **Strengths:** every requirement traces to at least one test; security rules covered systematically by a decision table; state-based testing covers invalid transitions, not only the happy path.
- **Omissions:** no concurrency tests (two users updating the same order at once); no database-failure injection; token expiry only tested with an already-expired token, not over 24 hours.
- **Weaknesses:** performance results come from one machine; the auth unit tests stub the database, so they cannot catch a wrong query.
- **Would the plan have caught each defect?** Check every F-item against the table in section 2.

## 6. Evaluation of the instrumentation (2.4)

*Fill in after Step 4. Starting points:*

- Coverage shows which lines ran, not whether their results were checked. The original suite passed while F1 existed (T1).
- The timing middleware has no correlation IDs and does not separate database time from application time.
- What better instrumentation would allow: database query timing, tracing a single request across components, fault injection hooks.

---

## 7. Plan changelog

| Date | Change | Reason |
| --- | --- | --- |
| 2026-11-05 | Plan created; in-process harness added (app/server split, in-memory DB) | Original suite could not measure coverage (T10) |
| 2026-11-05 | F1 RED test added to R-S2 | Matrix test returned the wrong user's email |
| | | |
