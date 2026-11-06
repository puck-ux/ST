# Testing Requirements

## System-level requirements — observable behaviour  at the API boundary.

### R-S1. Every endpoint except `/`, `/register` and `/login` must reject requests without a valid token (401)

**Type:** Security requirement (authentication).
**Testing approach:** Black-box API testing over every route with no `Authorization` header to create a table.
**Appropriateness:** A table containing every route ensures that a new route without protection will be identified. Using the 401 status allows for seperation between "not logged in" and "logged in but forbidden" (403).
*(Validated by)*


### R-S2. Only Admins may list users, read or delete another user, or read another user's orders

**Type:** Security requirement (authorisation).
**Testing approach:** Decision-table with role and endpoint.
**Appropriateness:** Decision-tables allow for combinations where multiple requests can be made with different users/roles. This is useful for testing where the output changes based on who is carrying out the request.
*(Validated by: `R-S2 role x endpoint matrix` and `R-S2 / F1` in `integration/access-control.test.js`. F1 currently fails.)*

### R-S3. A non-admin must not be able to become Admin by any route

**Type:** Security requirement (privilege escalation).
**Testing approach:** Negative testing of every route that writes a user: registering with `role: "Admin"`, `PUT /me` with `role`, and `PUT /me` with a MongoDB operator body `{"$set": {"role": "Admin"}}`; then check the user still gets 403 on `/users`.
**Appropriateness:** 

 The rule is that no route at all should let a user make themselves an admin, so every route that can change a user has to be tried, including a known trick that sneaks the change past the check. Afterwards the test checks whether the user can actually do admin things, because a change can succeed quietly even when the response looks harmless.
*(Planned: `integration/users.test.js`. Expected to expose F2 and F4.)*

### R-S4. Users may only read or change their own orders, and cannot reassign an order to another user

**Type:** Security requirement (authorisation, data ownership).
**Testing approach:** Two-user scenario tests: user A tries to read, update and delete user B's order; A tries to set `user` to B's id on their own order.
**Appropriateness:** You can only find out whether one user can touch another user's orders by having two users, so tests with a single user would never catch this. After each attempt the order is checked again to make sure it really wasn't changed.
*(Planned: `integration/orders.test.js`. Expected to expose F11.)*

### R-S5. No response may contain a password hash, and passwords must always be stored hashed

**Type:** Security requirement (confidentiality).
**Testing approach:** Assert `password` is absent from every user-returning response (`/register`, `/me`, `/users`, `/user/:id`); after changing a password via `PUT /me`, check the stored value is a bcrypt hash and that login with the new password works.
**Appropriateness:** A request can succeed and still leak private data, so the tests have to look at what is actually sent back, not just whether the request worked. Logging in with a newly changed password is a simple way to check from the outside that the password was saved properly.
*(Planned: `integration/users.test.js`. Expected to expose F5 and F6.)*

### R-S6. An admin must not be able to delete another admin

**Type:** Functional requirement (business rule).
**Testing approach:** Black-box API test with two admin accounts.
**Appropriateness:** This is one simple rule: an admin can delete a normal user but not another admin. One test for each case is all it needs.
*(Validated by: existing `should fail to delete an admin user` in `api/api.users-admin.test.js`, made non-vacuous; matrix row `DELETE /user/:id as admin -> 200`.)*

### R-P1. `GET /` must have p95 latency under 50 ms at 10 requests/s for 60 s on a local machine

**Type:** Performance requirement (measurable quality attribute).
**Testing approach:** Artillery load test, repeated 5 times; report mean p95 with a 95% confidence interval.
**Appropriateness:** Speed varies from run to run, so a single measurement can't be trusted. Running it five times and averaging gives a fair answer. `GET /` does almost no work, so it shows how fast the server is at its quickest, which every other request builds on.
*(Planned: `__tests__/performance/performance-test.yml`.)*

### R-P2. The login + order flow must have p95 latency under 300 ms at 10 arrivals/s with 0% errors

**Type:** Performance requirement.
**Testing approach:** Artillery scenario (register → login → create/read/update/delete order), 5 repeated runs, with an `ensure` threshold so the run fails automatically if p95 or the error rate is exceeded.
**Appropriateness:** This is what a real customer does, and it includes checking the password at login, which is deliberately the slowest step in the system. The original load test sent requests to addresses that don't exist (T6), so it had to be fixed before its results meant anything.
*(Planned: fixed `__tests__/performance/performance-test.yml`.)*

---

## Integration-level requirements

### R-I1. A token issued by `/login` must be accepted by protected routes

**Level:** Integration — `/register` and `/login` (users.js), the JWT, `authenticateToken` (auth.js) and MongoDB working together.
**Type:** Functional requirement.
**Testing approach:** In-process scenario test with supertest against an in-memory database: register → login → `GET /me` returns the same user.
**Appropriateness:** Each part can work fine on its own and still fail when joined together, for example if a login token is made one way and checked another. Testing the whole chain from sign-up to use shows the parts actually fit together, while still running quickly on its own temporary database.
*(Planned: `integration/users.test.js`.)*

### R-I2. An order created by POST must be returned by GET, changed by PUT, and return 404 after DELETE

**Level:** Integration — order routes, auth middleware and MongoDB.
**Type:** Functional requirement (persistence).
**Testing approach:** State-based testing: create → read → update → read → delete → read, checking both the HTTP responses and the stored document.
**Appropriateness:** The system could say an order was saved or changed when it wasn't, so the test checks both what the system says and what was actually stored. Following one order from creation to deletion matches how it would really be used.
*(Planned: `integration/orders.test.js`.)*

### R-I3. Malformed, unknown or missing IDs and request bodies must return 400 or 404, never 500, a hang or a crash

**Level:** Integration.
**Type:** Robustness requirement.
**Testing approach:** Negative tests and boundary values (invalid ObjectId `abc`, valid-but-unknown ID `000000000000000000000000`, empty body, missing password on login); property-based testing with generated request bodies, checking the server still answers `/` afterwards.
**Appropriateness:** Choosing bad inputs by hand covers the problems we can think of, and letting a tool generate random ones finds the ones we wouldn't think of. The test also checks the server is still running afterwards, because some bad inputs (F7) can crash it outright rather than just giving an error.
*(Planned: `integration/orders.test.js`, `integration/robustness.property.test.js`. Expected to expose F7, F9, F10.)*

---

## Unit-level requirements

### R-U1. Email validation must accept exactly the addresses of the form `local@domain.tld` with no whitespace

**Level:** Unit — the user schema's email validator.
**Type:** Functional requirement.
**Testing approach:** Equivalence partitioning and boundary values.
**Appropriateness:** Email addresses fall into a few kinds of right and wrong: missing the `@`, missing the dot, nothing before the `@`, a space inside, two `@`s, or empty. Testing one example of each kind, plus the shortest valid address (`a@b.c`), covers the rule without testing endless addresses.
*(Validated by: `R-U1 email validation` in `unit/models.test.js` — 10 cases, all passing.)*

### R-U2. `authenticateToken` must return 401 with no token, 403 for an invalid, expired or deleted-user token, and otherwise set `req.user` and call `next()`

**Level:** Unit — `endpoints/auth.js`.
**Type:** Functional and security requirement.
**Testing approach:** Unit test with test doubles: mocked `req`, `res` and `next`, and a stubbed `User.findOne`.
**Appropriateness:** This check protects almost every part of the system, so every way it can respond is tested on its own. Replacing the database with a stand-in makes it easy to set up awkward cases, such as a valid login for an account that has since been deleted, without creating real data.
*(Planned: `unit/auth.test.js`.)*

### R-U3. The user model must reject a missing name, email, password or address, and any role outside {User, Admin}

**Level:** Unit — `models/user.js`.
**Type:** Functional requirement.
**Testing approach:** Category-partition testing with `validateSync()`.
**Appropriateness:** Starting from a user that is fully valid and removing one field at a time shows exactly which rule rejects it. There are only two allowed roles, so the valid and invalid ones can simply be listed, including the easy mistake of a lowercase `admin`.
*(Validated by: `R-U3 user model required fields and role` in `unit/models.test.js` — 11 cases, all passing.)*

### R-U4. The order model must reject any type outside {Box1, Box2} and default to Box1

**Level:** Unit — `models/order.js`.
**Type:** Functional requirement.
**Testing approach:** Equivalence partitioning with `validateSync()`.
**Appropriateness:** There are only two box types plus a default, so testing both types, a few nearly-right wrong ones (`Box3`, `box1`, empty) and the default covers everything.
*(Validated by: `R-U4 order model type` in `unit/models.test.js` — 6 cases, all passing.)*

---

## Code-level requirement

### R-Q1. The code must be lint-clean, have no duplicate routes, and use consistent status codes (201 create, 200 update)

**Level:** Code.
**Type:** Qualitative requirement (maintainability).
**Testing approach:** Static analysis (ESLint with the security plugin) run in CI, plus a checklist-based code review.
**Appropriateness:** Problems like the same route written twice, or a variable used without being defined, don't show up when the system is used, so normal tests miss them. Reading the code, by a tool and by a person, finds them directly, and running the tool automatically on every change stops new ones creeping in.
*(Validated by: `npm run lint` — currently 5 errors; review findings in `docs/review.md` (planned).)*

---

## Deliberately not tested

- **Availability / uptime** — the system is never deployed, so there is nothing realistic to measure.
- **Concurrent updates to the same order** — would need a controlled concurrency harness; accepted because the system has few write paths.
- **Token expiry after 24 hours** — would need a fake clock; partly covered by testing an already-expired token in R-U2.
- **Database failure** — error paths when MongoDB is unavailable are checked by review only, not by fault injection. This is the most significant gap.