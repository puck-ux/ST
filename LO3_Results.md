# Testing Results
| Requirement | Level | Test file | Tests run | Passed | Failed |
| --- | --- | --- | --- | --- | --- |
| R-U1 | Unit | `unit/models.test.js` | 11 | 11 | 0 |
| R-U2 | Unit | `unit/auth.test.js` | 6 | 6 | 0 |
| R-I2 | Integration | `integration/orders.test.js` | 7 | 4 | 3 |
| R-I3 | Integration | `integration/robustness.test.js` | 8 | 6 | 2 |
| R-S2 | System | `integration/access-control.test.js` | 13 | 11 | 2 |
| R-S3 | System | `integration/escalation.test.js` | 3 | 1 | 2 |
| R-P2 | System | `performance/rp2-journey.yml` | 5 runs | 5 | 0 |
| **Total** | | | **48** | **39** | **9** |

**Note**
- The original load test (`performance/performance-test.yml`) did not work as it calls routes that do not exist (`/users/register`, `/users/login`, `/orders`) and registers every virtual user with the same email. It was replaced with `rp2-journey.yml`, which uses the correct PUTs and has a different user for each run.

## Evaluation criteria

| Technique | Criterion used to judge adequacy | Why this criterion |
| --- | --- | --- |
| Equivalence partitioning / boundary values (R-U1, R-I3) | Every partition has at least one test and every boundary is tested on both sides | Each partition represents for a whole class of inputs and each class needs to be tested |
| Test doubles (R-U2) | All exits need to be tested | The middleware only has a small set of outcomes so this is able to test all of them|
| State-based testing (R-I2) | All states and every action at those states | Each state of the order flow will need to be tested for a different response depending on scenario |
| Decision table (R-S2) | Every combination in the table has a test | Every combination must be tested and the table does this |
| Negative testing (R-S3) | Every route that can write a user's role is attempted and after the effect is tested | A partial check would miss a change that went through undetected|
| Property-based testing (R-I3 P4) | 200 generated inputs | Allows combinations to be tested that could be missed if hand-made, also improves time efficiency |
| Code coverage | Coverage of `app.js`, `endpoints/` and `models/` | Shows the code the tests did not cover |
| Load testing (R-P2) | Mean p95 latency over 5 runs with a 95% confidence interval | Interval and multiple runs give a good indication of real performance |

---

## Results

48 tests ran: **39 passed and 9 failed.** All 9 failures are caused by errors in the code which have been identified. Coverage is shown in the table below:

![All tests summary](LO3_images/All_Tests.PNG)

| Unit | Integration | System |
| --- | --- | --- |
| ![R-U1](LO3_images/R-U1.PNG) ![R-U2](LO3_images/R-U2.PNG) | ![R-I2](LO3_images/R-I2.PNG) ![R-I3](LO3_images/R-I3.PNG) | ![R-S2](LO3_images/R-S2.PNG) ![R-S3](LO3_images/R-S3.PNG) |

### Defects found

| ID | Requirement | Failing test | Expected | Actual | Cause |
| --- | --- | --- | --- | --- | --- |
| F1 | R-S2 | admin looking up user | that user's email | the admin's own email | `users.js:135` filters on a field that does not exist (`user`), so the query matches any user |
| F1 | R-S2 | admin looking up user who doesn't exist | 404 | 200 | same as above |
| F2 | R-S3 | using `$set` to change role to admin | role still `User` | role `Admin` | `users.js:191` only checks for a top-level `role` key; `{"$set": {"role": "Admin"}}` passes the check |
| F4 | R-S3 | registering with admin role | 403 on `GET /users` | 200 | `users.js:31` copies `role` from the request body into the new user |
| F7 | R-I3 | logging in without a password | 400 | no response | `bcrypt.compareSync` throws inside a callback (`users.js:66`), outside the `try/catch`; the request is never answered |
| F9 | R-I2 | updating a deleted order | 404 | 400 | `orders.js:105` reads `orderFound.user` before checking `orderFound` is not null |
| F9 | R-I2 | deleting an order twice | 404 | 400 | same pattern in the delete route |
| F10 | R-I3 | admin deleting a user that doesn't exist | 404 | 400 | `users.js:156` reads `userFound.role` before checking `userFound` is not null |
| F12 | R-I2 | updating the order | 200 | 201 | the update route returns 201 (Created) for an update |

F1, F2 and F4 are security defects. F7 is a robustness defect. F9 and F10 return the wrong error code. F12 returns the wrong code.

### Performance (R-P2)


| Run | p95 (ms) | 
| --- | --- |
| 1 | 13.1 
| 2 | 13.9 
| 3 | 13.9 
| 4 | 13.9 
| 5 | 13.9 

**Mean p95 = 13.74 ms, 95% confidence interval 13.30 – 14.18 ms** (n = 5, standard deviation 0.36 ms, t = 2.776). The time is well below the 300ms mark and zero users failed so **R-P2 is met**.

![R-P2 runs](LO3_images/R-P2.PNG)

---

## Evaluation of the results
CHANGE ALL
**Functional testing.** The unit-level components (email validation and the authentication middleware) behave correctly in every partition. Every failure appears at integration or system level, in the route handlers. This supports the bottom-up approach in the plan: because the components were shown to be correct first, each failure could be traced to how the routes use them rather than to the components themselves. Three of the nine failures are security defects (F1, F2, F4), which confirms that weighting the plan towards security was justified.

**Coverage.** Coverage shows which code ran, not whether its results were checked, so it is used here to find what was *not* tested:
- `users.js` is the weakest file (67.4% statements). Most uncovered lines are paths outside the chosen requirements: duplicate-email registration (37–43), wrong-password and unknown-email login (60, 72), the `/me` routes (175–205) and the admin-cannot-delete-admin rule (157, requirement R-S6, not in the chosen set).
- Lines 213–227 of `users.js` can **never** be covered: they are a second copy of the `GET /user/:userID` route, and Express always uses the first. This is dead code, a maintainability defect (R-Q1) that coverage revealed but no test could.
- The remaining gaps are `catch` blocks for database errors (e.g. `users.js:54–57`, `orders.js:86–92`). No test makes the database fail, so these error paths are untested. One of them (`users.js:55`) contains a further defect: it refers to `err` instead of `error`.

**Property-based testing.** 200 generated request bodies to `POST /order` produced no server error and no crash. This gives confidence that order creation is robust to unexpected input, but it covers one route only. The crash in F7 was found by a hand-written test, not the generator, because the generator was not applied to `/login`.

**Performance.** The measured p95 (about 14 ms) is around 20 times below the target, so R-P2 is met with a wide margin. Two limitations reduce what this shows: the server, database and load generator all ran on the same machine, so network delay is absent; and the near-identical p95 values (13.9 ms in four runs) come from Artillery reporting percentiles in fixed histogram buckets, so the true spread between runs is somewhat larger than the interval suggests. The result shows the system is comfortably fast under this load, not what its maximum capacity is.

