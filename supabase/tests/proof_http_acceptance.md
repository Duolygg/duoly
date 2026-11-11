# Private-proof HTTP acceptance

Hosted fixture execution is disabled. Offline safety tests remain available with `node --test supabase/tests/proof_http_acceptance.safety.test.cjs`.

SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.

The browser/provider multi-session harness is explicitly excluded from SQL CI; SQL passing does not claim HTTP, storage-byte or concurrency acceptance. A future local-only port must validate disposable container identity before fixtures.
