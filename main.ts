import { Client, SetActivity } from "@xhayper/discord-rpc"
import { loginFlow, Jellyfin } from "./jellyfinwrapper.ts";

if (!(Deno.env.has("token") && Deno.env.has("url"))) {
    await loginFlow();
    Deno.exit()
}


function run() {
    console.log("starting")
    const jf = new Jellyfin(Deno.env.get("url")!);
    jf.auth()
    
    const client = new Client({
        clientId: "1363567299948314906"
    });
    
    let id: number;
    client.on("ready", () => {
        console.log("alive!")
    
        const passiveInterval = async () => {
            const activity = await jf.getActivity()
            if (activity) {
                await client.user?.setActivity(activity as SetActivity);
                clearInterval(id);
                id = setInterval(activeInterval, 3000);
            }
        }
        const activeInterval = async () => {
            const activity = await jf.getActivity()
            if (activity) {
                await client.user?.setActivity(activity as SetActivity);
            } else {
                await client.user?.clearActivity();
                clearInterval(id);
                id = setInterval(passiveInterval, 30000);
            }
        }
        id = setInterval(passiveInterval, 30000);
    });
    
    client.login();
    
    const unload = async () => {
        await client.user?.clearActivity()
        await client.destroy()
        clearInterval(id)
    }
    
    globalThis.addEventListener("unload", unload)


    let timeoutId: number;
    client.on("ERROR", () => {
        unload()
        globalThis.removeEventListener("unload", unload)
        clearTimeout(timeoutId)
        clearInterval(id);
        timeoutId = setTimeout(run, 60000)
        console.log("dead")
    })

    client.on("disconnected", () => {
        globalThis.removeEventListener("unload", unload)
        clearTimeout(timeoutId)
        clearInterval(id);
        timeoutId = setTimeout(run, 60000)
        console.log("dead")
    })
}

run()
