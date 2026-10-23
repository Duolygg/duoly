# Isolated chat browser fixture

This is a separate Astro application, not a route in the production application. It imports the real product components and shared layout. Browser tests intercept all order/chat/evidence API calls with explicitly fictional fixtures. No account credentials or real database state are used.

Run the pinned Node Astro CLI with `dev --root tests/fixtures/chat-ui --host 127.0.0.1 --port 4334`. Fixture state must never be imported into production source. Provider acceptance and real concurrent SQL tests remain separate release gates.
