import { Client, SetActivity } from "@xhayper/discord-rpc";
import { UnderstandableRPC } from "../rpc/rpcTypes.ts";
import { log } from "../utility.ts";


export let dc_instance: Discord;

export class Discord {
    private client: Client;
    private app_id: string;
    lastRPC: UnderstandableRPC|undefined
    active = false;

    constructor(app_id: string) {
        dc_instance = this;
        this.app_id = app_id;

        this.client = new Client({
            clientId: app_id
        })
        
        this.client.on("ready", () => {
            log("rpc", "ready!")
            this.updateRpc();
            this.active = true
        })
        this.client.on("disconnected", this.reconnect)
        this.client.on("ERROR", this.reconnect)
 
        this.client.login()
            .catch(() => {
                log("RPC", "Failed to connect to discord")
                this.active = true
                this.reconnect()
            })
    }

    destroy() {
        if (!this.active) return
        log("rpc", "uninitilizing...")
        this.client.user?.clearActivity();
        this.client.destroy()
        this.active = false;
    }

    private reconnect() {
        log("rpc", "Connection lost or error. Reconnecting in 60 seconds")
        this.destroy()
        setTimeout(() => {
            new Discord(this.app_id)
        }, 60_000)
    }

    updateRpc(data?: UnderstandableRPC) {
        if (!this.active) return;
        if (!this.client.isConnected) return this.reconnect()
        if (!data) {
            if (this.lastRPC) {
                log("rpc", "Clearing")
                this.client.user?.clearActivity();
                this.lastRPC = undefined
            }
            return
        }

        log("rpc", "Updating")
        const realData:SetActivity = {
            // @ts-ignore its ok
            type: data.type,
            state: data.subtitle,
            details: data.title,
            smallImageKey: data.smallImage?.url,
            smallImageText: data.smallImage?.tooltip,
            largeImageKey: data.largeImage?.url,
            largeImageText: data.largeImage?.tooltip == data.title ? undefined : data.largeImage?.tooltip,
            startTimestamp: data.paused ? undefined : data.timestamp?.start,
            endTimestamp: data.paused ? undefined : data.timestamp?.end
        }

        this.client.user?.setActivity(realData);
        this.lastRPC = data;
    }
}
