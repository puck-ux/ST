# Testing Requirements

## System-level requirements — observable behaviour at the API boundary.

### R-S1. Every endpoint except `/`, `/register` and `/login` must reject requests without a valid token (401)

**Type:** Security requirement (authentication). \
**Testing approach:** Black-box API testing over every route with no `Authorization` header to create a table. \
**Appropriateness:** A table containing every route ensures that a new route without protection will be identified. Using the 401 status allows for seperation between "not logged in" and "logged in but forbidden" (403). \
*(Validated by)* 


### R-S2. Only Admins may list users, read or delete another user, or read another user's orders

**Type:** Security requirement (authorisation). \
**Testing approach:** Decision-table with role and endpoint. \
**Appropriateness:** Decision-tables allow for combinations where multiple requests can be made with different users/roles. This is useful for testing where the output changes based on who is carrying out the request. \
*(Validated by)*

### R-S3. A non-admin must not be able to become Admin by any route

**Type:** Security requirement (privilege escalation). \
**Testing approach:** CHANGE Negative testing of every route that writes a user: registering with `role: "Admin"`, `PUT /me` with `role`, and `PUT /me` with a MongoDB operator body `{"$set": {"role": "Admin"}}`; then check the user still gets 403 on `/users`. \
**Appropriateness:** There should be no way for a user to make themselves an admin, so every route that could must be tried. After running the test there are checks to see if the user can perform admin actions as the test's results may not provide an accurate result. \
*(Validated by)*

### R-S4. Users may only read or change their own orders, and cannot reassign an order to another user

**Type:** Security requirement (authorisation, data ownership). \
**Testing approach:** CHANGE Two-user scenario tests: user A tries to read, update and delete user B's order; A tries to set `user` to B's id on their own order. \
**Appropriateness:** It is only possible to determine if a user may affect another user's order by having two users. After each attempt from user A the order is checked to make sure it wasn't changed. \
*(Validated by)*

### R-S5. No response may contain a password hash, and passwords must always be stored hashed

**Type:** Security requirement (confidentiality). \
**Testing approach:** CHANGE Assert `password` is absent from every user-returning response (`/register`, `/me`, `/users`, `/user/:id`); after changing a password via `PUT /me`, check the stored value is a bcrypt hash and that login with the new password works. \
**Appropriateness:** A users password must never be made available from a request so the tests must look at all requests and their responses. To check if a user's password is stored correctly the tests will change the password and re-log in. \
*(Validated by)*

### R-S6. An admin must not be able to delete another admin

**Type:** Functional requirement (business rule). \
**Testing approach:** Black-box API testing with two admin accounts. \
**Appropriateness:** Admins should only be able to delete normal users, not admins, so one there is just one test for each case. \
*(Validated by)*

### R-P1. `GET /` must have p95 latency under 50 ms at 10 requests/s for 60 s on a local machine

**Type:** Performance requirement (measurable quality attribute). \
**Testing approach:** CHANGE Artillery load test, repeated 5 times; report mean p95 with a 95% confidence interval. \
**Appropriateness:** Averaging speeds will give a clearer picture than one run. GET requests are computationally easy so it gives a good picture of the server at its fastest. \
*(Validated by)*

### R-P2. The login + order flow must have p95 latency under 300 ms at 10 arrivals/s with 0% errors

**Type:** Performance requirement. \
**Testing approach:** CHANGE Artillery scenario (register → login → create/read/update/delete order), 5 repeated runs, with an `ensure` threshold so the run fails automatically if p95 or the error rate is exceeded. \
**Appropriateness:** Same as above testing server speed but with customer request flow. Tests the slowest parts of the system so delay requirement is lower. \
*(Validated by)*

---

## Integration-level requirements

### R-I1. A token issued by `/login` must be accepted by protected routes

**Level:** CHANGE Integration — `/register` and `/login` (users.js), the JWT, `authenticateToken` (auth.js) and MongoDB working together. \
**Type:** Functional requirement. \
**Testing approach:** CHANGE In-process scenario test with supertest against an in-memory database: register → login → `GET /me` returns the same user.
**Appropriateness:** Each request can work in its own, so they must be tested together to ensure that the routes work correctly. \
*(Validated by)*

### R-I2. An order created by POST must be returned by GET, changed by PUT, and return 404 after DELETE

**Level:** CHANGE Integration — order routes, auth middleware and MongoDB. \
**Type:** Functional requirement (persistence). \
**Testing approach:** CHANGE State-based testing: create → read → update → read → delete → read, checking both the HTTP responses and the stored document. \
**Appropriateness:** Checks what the system says and what was stored as it might be wrong. Following the route from creation to deletion simulates how it would be used. \
*(Validated by)*

### R-I3. Malformed, unknown or missing IDs and request bodies must return 400 or 404, never 500, a hang or a crash

**Level:** CHANGE Integration. \
**Type:** Robustness requirement. \
**Testing approach:** CHANGE Negative tests and boundary values (invalid ObjectId `abc`, valid-but-unknown ID `000000000000000000000000`, empty body, missing password on login); property-based testing with generated request bodies, checking the server still answers `/` afterwards. \
**Appropriateness:** Randomly generated inputs cover problems that woulodn't be thought of. The test checks if the server is still running after to ensure bad inputs do not cause a crash. \
*(Validated by)*

---

## Unit-level requirements

### R-U1. Email validation must accept exactly the addresses of the form `local@domain.tld` with no whitespace

**Level:** CHANGE Unit — the user schema's email validator. \
**Type:** Functional requirement. \
**Testing approach:** Equivalence partitioning and boundary values. \
**Appropriateness:** Equivalence partitioning will cover different invalid email addresses. Tests one example of each kind as well as shortest valid address (boundary value). \
*(Validated by)*

### R-U2. `authenticateToken` must return 401 with no token, 403 for an invalid, expired or deleted-user token, and otherwise set `req.user` and call `next()
**Level:** CHANGE Unit — `endpoints/auth.js`. \
**Type:** Functional and security requirement. \
**Testing approach:** CHANGE Unit test with test doubles: mocked `req`, `res` and `next`, and a stubbed `User.findOne`. \
**Appropriateness:** CHANGE This check protects almost every part of the system, so every way it can respond is tested on its own. Replacing the database with a stand-in makes it easy to set up awkward cases, such as a valid login for an account that has since been deleted, without creating real data. \
*(Planned: `unit/auth.test.js`.)*

### R-U3. The user model must reject a missing name, email, password or address, and any role outside {User, Admin}

**Level:** CHANGE Unit — `models/user.js`. \
**Type:** Functional requirement. \
**Testing approach:** Category-partition testing with `validateSync()`. \
**Appropriateness:** Test valid user entry then each variation missing a field. Allows the test to see which rule rejects it. Role can be one of two options so valid and ivalid are easy to list. \
*(Validated by)*

### R-U4. The order model must reject any type outside {Box1, Box2} and default to Box1

**Level:** CHANGE Unit — `models/order.js`. \
**Type:** Functional requirement. \
**Testing approach:** Equivalence partitioning with `validateSync()`. \
**Appropriateness:** Only two valid box types so testing those and default covers everything. \
*(Validated by)*

---

## Code-level requirement

### R-Q1. The code must be lint-clean, have no duplicate routes, and use consistent status codes (201 create, 200 update)

**Level:** CHANGE Code. \
**Type:** Qualitative requirement (maintainability). \
**Testing approach:** CHANGE Static analysis (ESLint with the security plugin) run in CI, plus a checklist-based code review. \
**Appropriateness:** Will read over all the code and flag anything that would be missed in a test. Using a human and a tool will find them directly and ensure that nothing is missed. \
*(Validated by)*

---

## Deliberately not tested CHANGE

- **Availability / uptime** — the system is never deployed, so there is nothing realistic to measure.
- **Concurrent updates to the same order** — would need a controlled concurrency harness; accepted because the system has few write paths.
- **Token expiry after 24 hours** — would need a fake clock; partly covered by testing an already-expired token in R-U2.
- **Database failure** — error paths when MongoDB is unavailable are checked by review only, not by fault injection. This is the most significant gap.