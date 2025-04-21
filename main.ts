import { ClientSideDiscord, ServerSideDiscord, UnderstandableRPC } from "./Discord.ts";
import { Jellyfin } from "./Jellyfin.ts";
import { log } from "./logger.ts";

if (!(Deno.env.has("jellyfin_url") && Deno.env.get("jellyfin_url") != "" &&
    Deno.env.has("jellyfin_user") && Deno.env.get("jellyfin_user") != "" &&
    Deno.env.has("jellyfin_password") && Deno.env.get("jellyfin_password") != "" &&
    Deno.env.has("serverside") && Deno.env.get("serverside") != ""
)) {
    throw Error("Not all env variables are set")
}
if (Deno.env.get("serverside") == "true")  {
    if (!(Deno.env.has("discord_token") && Deno.env.get("discord_token") != "")) {
        throw Error("Not all env variables are set")
    }
}

const jf = new Jellyfin(
    Deno.env.get("jellyfin_url")!, {
        username: Deno.env.get("jellyfin_user")!,
        password: Deno.env.get("jellyfin_password")!
    })

const makeDiscord = () => Deno.env.get("serverside")! == "true"
    ? new ServerSideDiscord(Deno.env.get("discord_token")!)
    : new ClientSideDiscord("1363567299948314906")

let dc = makeDiscord()
dc.init()

let lastrpc: UnderstandableRPC
function preventSpam(rpc: UnderstandableRPC) {
    if (lastrpc == undefined) {
        dc.rpc(rpc)
    } else if (!(
        lastrpc.type == rpc.type &&
        lastrpc.title == rpc.title &&
        lastrpc.subtitle == rpc.subtitle &&
        lastrpc.largeImage?.url == rpc.largeImage?.url &&
        lastrpc.smallImage?.url == rpc.smallImage?.url &&
        lastrpc.paused == rpc.paused &&
        lastrpc.timestamp?.end == rpc.timestamp?.end)) {
        dc.rpc(rpc)
    } else {
        log("Duplicate update")
    }
    lastrpc = rpc
}

setTimeout(() => {
    let failCounter = 0;
    let idle = false;
    let idleCounter = 0;
    let intervalId:number;

    async function ticker() {
        if (!dc.connected) {
            log("lost connection")
            clearInterval(intervalId)
            dc.destroy()
            await new Promise(r => setTimeout(r, 60000))
            log("reattempting connection")
            dc = makeDiscord()
            dc.init()
            await new Promise(r => setTimeout(r, 10000))
            failCounter = 0
            idle = false
            idleCounter = 0
            log("Starting ticker again")
            intervalId = setInterval(ticker, 3000)
            return;
        }

        if (idle) {
            if (idleCounter++ < 15) return
            const rpc = await jf.getRpc();
            if (rpc) {
                dc.rpc(rpc)
                idle = false
                log("Leaving idle")
                idleCounter = 0;
            }
        } else {
            const rpc = await jf.getRpc()
            if (rpc) {
                preventSpam(rpc);
                failCounter = 0
            } else {
                log(`Failed ${failCounter+1}/4`)
                dc.rpc(undefined)
                if (failCounter++ > 4) {
                    idle = true
                    log("Entering idle")
                    failCounter = 0
                }
            }
        }
    }

    intervalId = setInterval(ticker, 4000)
}, 10000)

Deno.addSignalListener("SIGINT", async () => {
    log("Cleaning up")
    await dc.rpc()
    dc.destroy()
    log("Exiting")
    await new Promise(r => setTimeout(r, 1000));
    Deno.exit(1)
})
