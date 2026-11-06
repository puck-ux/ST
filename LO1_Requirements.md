# Testing Requirements

## System-level requirements — observable behaviour  at the API boundary.

### R-S1. Every endpoint except `/`, `/register` and `/login` must reject requests without a valid token (401)

**Type:** Security requirement (authentication).
**Testing approach:** Black-box API testing over every route with no `Authorization` header to create a table
**Appropriateness:** A table containing every route ensures that a new route without protection will be identified. Using the 401 status allows for seperation between "not logged in" and "logged in but forbidden" (403).
*(Validated by)*



### R-S2. Only Admins may list users, read or delete another user, or read another user's orders

**Type:** Security requirement (authorisation).
**Testing approach:** Decision-table (role × endpoint) testing; one row per combination with the expected status.
**Appropriateness:** Access control is a set of independent rules over two inputs (who you are, what you ask for), which is exactly the shape a decision table covers systematically. It also catches the case where an admin route returns the *wrong* data, not just the wrong status, so F1 is tested by checking the returned user's email.
*(Validated by: `R-S2 role x endpoint matrix` and `R-S2 / F1` in `integration/access-control.test.js`. F1 currently fails.)*

### R-S3. A non-admin must not be able to become Admin by any route

**Type:** Security requirement (privilege escalation).
**Testing approach:** Negative testing of every route that writes a user: registering with `role: "Admin"`, `PUT /me` with `role`, and `PUT /me` with a MongoDB operator body `{"$set": {"role": "Admin"}}`; then check the user still gets 403 on `/users`.
**Appropriateness:** The rule is "no route", so the test must try each write route and the known bypass for Mongo updates. Checking the effect (403 afterwards) rather than only the response code catches escalations that report success quietly.
*(Planned: `integration/users.test.js`. Expected to expose F2 and F4.)*

### R-S4. Users may only read or change their own orders, and cannot reassign an order to another user

**Type:** Security requirement (authorisation, data ownership).
**Testing approach:** Two-user scenario tests: user A tries to read, update and delete user B's order; A tries to set `user` to B's id on their own order.
**Appropriateness:** Ownership bugs only appear with two users, so single-user tests cannot find them. Reading the order back from the database after the attempt confirms nothing changed.
*(Planned: `integration/orders.test.js`. Expected to expose F11.)*

### R-S5. No response may contain a password hash, and passwords must always be stored hashed

**Type:** Security requirement (confidentiality).
**Testing approach:** Assert `password` is absent from every user-returning response (`/register`, `/me`, `/users`, `/user/:id`); after changing a password via `PUT /me`, check the stored value is a bcrypt hash and that login with the new password works.
**Appropriateness:** Information disclosure is invisible to status-code checks, so the test must inspect response bodies. The login check turns a storage detail into observable behaviour.
*(Planned: `integration/users.test.js`. Expected to expose F5 and F6.)*

### R-S6. An admin must not be able to delete another admin

**Type:** Functional requirement (business rule).
**Testing approach:** Black-box API test with two admin accounts.
**Appropriateness:** A single explicit rule with one forbidden case and one allowed case (deleting a normal user); two tests cover it fully.
*(Validated by: existing `should fail to delete an admin user` in `api/api.users-admin.test.js`, made non-vacuous; matrix row `DELETE /user/:id as admin -> 200`.)*

### R-P1. `GET /` must have p95 latency under 50 ms at 10 requests/s for 60 s on a local machine

**Type:** Performance requirement (measurable quality attribute).
**Testing approach:** Artillery load test, repeated 5 times; report mean p95 with a 95% confidence interval.
**Appropriateness:** One run of a latency test is noise; repeating it and giving an interval makes the pass/fail decision defensible. `GET /` has no database or bcrypt work, so it measures the framework baseline that the other endpoints build on.
*(Planned: `__tests__/performance/performance-test.yml`.)*

### R-P2. The login + order flow must have p95 latency under 300 ms at 10 arrivals/s with 0% errors

**Type:** Performance requirement.
**Testing approach:** Artillery scenario (register → login → create/read/update/delete order), 5 repeated runs, with an `ensure` threshold so the run fails automatically if p95 or the error rate is exceeded.
**Appropriateness:** This is the realistic user journey and includes bcrypt hashing, the most expensive operation in the system. The existing script calls routes that do not exist (T6), so it must be fixed before its numbers mean anything.
*(Planned: fixed `__tests__/performance/performance-test.yml`.)*

---

## Integration-level requirements

### R-I1. A token issued by `/login` must be accepted by protected routes

**Level:** Integration — `/register` and `/login` (users.js), the JWT, `authenticateToken` (auth.js) and MongoDB working together.
**Type:** Functional requirement.
**Testing approach:** In-process scenario test with supertest against an in-memory database: register → login → `GET /me` returns the same user.
**Appropriateness:** Each component can be correct on its own while the chain fails (e.g. a mismatched secret or token format). Testing the chain in-process keeps it fast and isolated while still exercising the real code paths.
*(Planned: `integration/users.test.js`.)*

### R-I2. An order created by POST must be returned by GET, changed by PUT, and return 404 after DELETE

**Level:** Integration — order routes, auth middleware and MongoDB.
**Type:** Functional requirement (persistence).
**Testing approach:** State-based testing: create → read → update → read → delete → read, checking both the HTTP responses and the stored document.
**Appropriateness:** Persistence bugs show up as a mismatch between what the API reports and what is stored, so the test checks both. A full lifecycle in one test mirrors real use.
*(Planned: `integration/orders.test.js`.)*

### R-I3. Malformed, unknown or missing IDs and request bodies must return 400 or 404, never 500, a hang or a crash

**Level:** Integration.
**Type:** Robustness requirement.
**Testing approach:** Negative tests and boundary values (invalid ObjectId `abc`, valid-but-unknown ID `000000000000000000000000`, empty body, missing password on login); property-based testing with generated request bodies, checking the server still answers `/` afterwards.
**Appropriateness:** Hand-picked bad inputs cover known risks; generated inputs cover the ones nobody thought of. Checking that the server is still alive afterwards is necessary because some faults (F7) throw outside the request's error handling.
*(Planned: `integration/orders.test.js`, `integration/robustness.property.test.js`. Expected to expose F7, F9, F10.)*

---

## Unit-level requirements

### R-U1. Email validation must accept exactly the addresses of the form `local@domain.tld` with no whitespace

**Level:** Unit — the user schema's email validator.
**Type:** Functional requirement.
**Testing approach:** Equivalence partitioning and boundary values.
**Appropriateness:** Emails split cleanly into valid and invalid classes (no `@`, no dot in the domain, nothing before `@`, inner space, two `@`, empty). One representative per class plus the smallest valid case (`a@b.c`) covers the rule without enumerating addresses.
*(Validated by: `R-U1 email validation` in `unit/models.test.js` — 10 cases, all passing.)*

### R-U2. `authenticateToken` must return 401 with no token, 403 for an invalid, expired or deleted-user token, and otherwise set `req.user` and call `next()`

**Level:** Unit — `endpoints/auth.js`.
**Type:** Functional and security requirement.
**Testing approach:** Unit test with test doubles: mocked `req`, `res` and `next`, and a stubbed `User.findOne`.
**Appropriateness:** The middleware guards every protected route, so it deserves isolated, exhaustive tests of each branch. Stubbing the database lets each branch be forced directly (e.g. "token valid but user deleted") without setting up data.
*(Planned: `unit/auth.test.js`.)*

### R-U3. The user model must reject a missing name, email, password or address, and any role outside {User, Admin}

**Level:** Unit — `models/user.js`.
**Type:** Functional requirement.
**Testing approach:** Category-partition testing with `validateSync()`.
**Appropriateness:** Each required field is an independent category; removing one at a time from a known-valid user isolates each rule. Role is a small closed set, so its valid and invalid values can be listed outright, including the near-miss `admin`.
*(Validated by: `R-U3 user model required fields and role` in `unit/models.test.js` — 11 cases, all passing.)*

### R-U4. The order model must reject any type outside {Box1, Box2} and default to Box1

**Level:** Unit — `models/order.js`.
**Type:** Functional requirement.
**Testing approach:** Equivalence partitioning with `validateSync()`.
**Appropriateness:** A two-value enum with a default: both valid values, a few near-miss invalid values (`Box3`, `box1`, empty) and the default case cover it completely.
*(Validated by: `R-U4 order model type` in `unit/models.test.js` — 6 cases, all passing.)*

---

## Code-level requirement

### R-Q1. The code must be lint-clean, have no duplicate routes, and use consistent status codes (201 create, 200 update)

**Level:** Code.
**Type:** Qualitative requirement (maintainability).
**Testing approach:** Static analysis (ESLint with the security plugin) run in CI, plus a checklist-based code review.
**Appropriateness:** Maintainability problems such as the duplicated `/user/:userID` route or an undefined variable are not visible to behavioural tests, but static analysis and review find them directly. Running lint in CI keeps it enforced.
*(Validated by: `npm run lint` — currently 5 errors; review findings in `docs/review.md` (planned).)*

---

## Deliberately not tested

- **Availability / uptime** — the system is never deployed, so there is nothing realistic to measure.
- **Concurrent updates to the same order** — would need a controlled concurrency harness; accepted because the system has few write paths.
- **Token expiry after 24 hours** — would need a fake clock; partly covered by testing an already-expired token in R-U2.
- **Database failure** — error paths when MongoDB is unavailable are checked by review only, not by fault injection. This is the most significant gap.