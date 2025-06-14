import { env, log, shouldUpdate, validateEnv } from "./utility.ts";
import { dc_instance, Discord } from "./discord/index.ts";
import { Jellyfin, jf_instance } from "./jellyfin/index.ts";
import { UnderstandableRPC } from "./rpc/rpcTypes.ts";
log("main", "Validating Env-variables...")
validateEnv()
log("main", "Valid")


log("main", "Initializing Jellyfin")
new Jellyfin(env("jellyfin_url"), {
    Username: env("jellyfin_user"),
    Pw: env("jellyfin_password")
})
log("main", "Initializing Discord")
new Discord("1363567299948314906")

let idle = false;
let repeatCounter = 0;
let emptyCounter = 0;


async function idleLoop() {
    if (++repeatCounter < 15) return // wait for a minute
    repeatCounter = 0

    const rpc = await jf_instance.getRpc();
    if (rpc) {
        dc_instance.updateRpc(rpc)
        idle = false
        log("idle", "leaving idle")
    }
    log("idle", "staying idle")
}
async function activeLoop() {
    const rpc = await jf_instance.getRpc();
    if (rpc) {
        // wait for 36 seconds
        if (!shouldUpdate(rpc)) {
            log("active", "no update necessary - everything stayed the same")
            if (++repeatCounter < 10) {
                return
            }
            log("active", "Updating anyway to keep RPC alive")
        }
        repeatCounter = 0;
        dc_instance.updateRpc(rpc)
    } else {
        log("active", "no RPC generated.", 4 - emptyCounter, "attempts left before going into idle")
        dc_instance.updateRpc() // clear rpc
        emptyCounter++
        if (emptyCounter > 4) {
            log("active", "entering idle...")
            idle = true
            repeatCounter = 0
            emptyCounter = 0 
        }
    }
}

let intervalId: number;

log("main", "waiting 20 seconds before starting main loop...")
setTimeout(() => {
    intervalId = setInterval(() => {
        idle ? idleLoop() : activeLoop()
    }, 4_000)
    log("main", "started!")
}, 20_000)


Deno.addSignalListener("SIGINT", async () => {
    log("- main -", "EXIT REQUEST", "Stopping main loop")
    clearInterval(intervalId);
    log("- main -", "EXIT REQUEST", "Quitting discord RPC connection")
    dc_instance.destroy()
    log("- main -", "EXIT REQUEST", "Waiting for 1 second")
    await new Promise(r => setTimeout(r, 1000));
    log("- main -", "EXIT REQUEST", "Good bye!")
    Deno.exit(1)
})
