# Local and Server-side Jellyfin Discord RPC

Support for Music, Movies and Episodes.

You need to have deno and npm installed.

- Takes 20 seconds to start (grace period to start discord).
- Updates every 4 seconds.
- If no Activity is detected goes to idle and only checks once a minute.
- If RPC Connection is lost it waits 1 minute to attempt to reconnect.

You need a Jellyfin server (duh)

Just run `makeItWorkAlready.sh`

> Personal Project -> No promise for support or function.
