# Testing Plan

## Chosen set of requirements

### List of requirements to be tested

- **R-U1:** Email validation must accept exactly the addresses of the form `local@domain.tld` with no whitespace.
- **R-U2:** `authenticateToken` must return 401 with no token, 403 for an invalid, expired or deleted-user token, and otherwise set `req.user` and call `next()`.
- **R-I2:** An order created by POST must be returned by GET, changed by PUT, and return 404 after DELETE.
- **R-I3:** Malformed or unknown IDs and missing request fields must return 400 or 404, never 500 or a crash.
- **R-S2:** Only Admins may list users, read or delete another user, or read another user's orders.
- **R-S3:** A non-admin must not be able to become Admin by any route.
- **R-P2:** The login + order flow must have p95 latency under 300 ms at 10 arrivals/s with 0% errors.

### Justification

The seven requirements were chosen so that they cover all three levels and four requirement types: functional (R-U1 & R-I2), robustness (R-I3), security (R-U2, R-S2 & R-S3) and performance (R-P2). Security is a high concern as there is the risk of a regular user altering data or gaining administrative privileges. Functionality is also a concern as the system must behave correctly or it won't be able to meet the specification, this links into robustness as a the system must be able to handle malformed or incorrect data properly. The system must also be able to perform well under load without errors.

---

## Testing Levels and Approaches

### Unit Level

The unit-level tests target email validation with `validateSync()` and token authentication with `authenticateToken`. Equivalence partitioning and boundary values are used to cover a wide variety of email inputs. Test doubles are used in isolation so that each of the four outcomes of the token authentication can be forced.

### Integration Level

The integration-level tests target order creation and flow, and malformed or unkown IDs and missing fields. Unit-tests are used for R-I2 to confirm everything works in isolation. State-based testing is then used so that any failure will be linked to how the parts interact. Negative-testing is used so that any incorrect ID input or missing field returns an error and the system is tested after to ensure it is still running.

### System Level

The system-level tests target user privilege and privilege escalation. The system API is tested as a black-box over HTTP. A decision table containing role and enpoint combinations confirms the different users' privilege. Negative-testing is used so that any route a user could go down does can be tested to ensure they are unable to become an administrator.\
Performance is tested with Artillery, repeated five times and reported as mean p95 with a 95% confidence interval.

---

## Detailed Partitions and Test Cases

### R-U1 – Email Validation

**Identified factors:**\
Email validity\
E1: Address has the correct form\
E2: Address is missing a part or has invalid characters

**Partitions:**

P1 – Shortest valid address (E1, boundary)
- Input: `a@b.c`
- Output: no validation error
- Specification: System accepts the smallest complete address

P2 – Typical valid address (E1)
- Input: `john.smith@ed.ac.uk`, `JOHN@example.com`, `  john@ed.ac.uk  `
- Output: no validation error
- Specification: valid addresses accepted; uppercase stored as lowercase; spaces trimmed

P3 – Invalid address (E2)
- Input: `johnexample.com`, `john@example`, `@example.com`, `john smith@example.com`, `john@@example.com`, `""`, `john.com@example`
- Output: validation error on `email`
- Specification: System rejects invalid email

### R-U2 – Authentication Middleware

**Identified factors:**\
A1: No token\
A2: Invalid token\
A3: Valid token, user deleted\
A4: Valid token, user exists

**Partitions:**

P1 – No token (A1)
- Input: no `Authorization` header; `"Bearer"` with nothing after it
- Output: 401; `next` not called
- Specification: System rejects unauthenticated requests

P2 – Invalid token (A2)
- Input: token signed with the wrong secret; expired token
- Output: 403; `next` not called
- Specification: System rejects unverified tokens 

P3 – Deleted user (A3)
- Input: valid token; `User.findOne` stubbed to return `null`
- Output: 403; `next` not called
- Specification: System rejects tokens for deleted accounts

P4 – Valid user (A4)
- Input: valid token; `User.findOne` stubbed to return `{ role: "Admin" }`
- Output: `req.user` has the id and role `Admin`; `next` called once
- Specification: valid requests continue with the user's current role

### R-I2 – Order Lifecycle (State-Based)

States: **No order** and **Exists**. POST moves No order → Exists, PUT keeps it in Exists, DELETE moves Exists → No order, GET observes.

**Identified factors:**\
S1: Valid transition\
S2: Action on a deleted order

**Partitions:**

P1 – Valid lifecycle (S1)
- Input: `POST /order` → `GET /order/:id` → `PUT /order` (type → Box2) → `DELETE /order/:id`
- Output: 201 → 200 (matches DB) → 200 (DB shows Box2) → 200 (removed from DB)
- Specification: each transition gives the right response and the stored order matches

P2 – Actions after delete (S2)
- Input: `GET`, `PUT` and `DELETE` on the deleted order
- Output: 404 for each
- Specification: a deleted order cannot be read, changed or deleted again

### R-I3 – Malformed or Unkown ID and Missing Field Robustness

**Identified factors:**\
B1: Wrong ID format\
B2: Unknown ID\
B3: Missing fields\
B4: Generated input

**Partitions:**

P1 – Wrong ID format (B1, boundaries)
- Input: 23, 25 and 24 characters with a non-hex character
- Output: 400
- Specification: System rejects malformed IDs

P2 – Unknown ID (B2, boundary)
- Input: `000000000000000000000000` on `GET /order/:id` and `DELETE /user/:id` (admin)
- Output: 404
- Specification: unknown IDs return not found 

P3 – Missing fields (B3)
- Input: `POST /register` with `{}`; `POST /login` with no password
- Output: 400; server alive post-input
- Specification: System rejects missing fields without crashing 

P4 – Generated input (B4)
- Input: 200 random JSON bodies sent to `POST /order`
- Output: every status below 500; `GET /` still returns 200
- Specification: no input returns an error

### R-S2 – Admin-Only Access (Decision Table)

**Identified factors:**\
C1: Caller is a User\
C2: Caller is an Admin

**Partitions:**

P1 – User calls admin routes (C1)
- Input: `GET /users`, `GET /user/:id`, `GET /orders/user/:id`, `DELETE /user/:id`, and `GET`/`DELETE` on another user's order
- Output: 403
- Specification: normal users cannot use admin routes or reach others' orders

P2 – Admin calls admin routes (C2)
- Input: the same routes as an Admin
- Output: 200
- Specification: admins can use them

P3 – Admin reads a specific user (C2)
- Input: `GET /user/:id` for a known user; `GET /user/000000000000000000000000`
- Output: 200 with user's email; 404 for the unknown id
- Specification: Server returns requested user's email to admin

### R-S3 – No Privilege Escalation

**Identified factors:**\
X1: Role set at registration\
X2: Role set on profile update\
X3: Role set through a database operator

**Partitions:**

P1 – Register as admin (X1)
- Input: `POST /register` with `role: "Admin"`, log in, `GET /users`
- Output: 403 on `GET /users`
- Specification: new accounts cannot choose their role

P2 – Direct role change (X2)
- Input: `PUT /me` with `{ "role": "Admin" }`
- Output: 403; role still `User`
- Specification: the role field cannot be updated

P3 – Operator bypass (X3)
- Input: `PUT /me` with `{ "$set": { "role": "Admin" } }`, then `GET /users`
- Output: role still `User`; 403 on `GET /users`
- Specification: the role check cannot be bypassed

### R-P2 – User Journey Latency

**Identified factors:**\
M1: Realistic flow under load

**Partition:**

P1 – Full journey under load (M1)
- Input: register → login → create, read, update, delete order, 10 arrivals/s for 60s, repeated 5 times
- Output: p95 and error rate per run; mean p95 with 95% confidence interval
- Specification: mean p95 below 300 ms, 0% errors