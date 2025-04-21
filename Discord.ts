import { Client, SetActivity } from "@xhayper/discord-rpc";
import { ActivityType } from "discord-api-types/v10";
import { log } from "./logger.ts";

type RPC = {
    app_id: string
    type: ActivityType,
    metadata: {},
    flags: number,
    name: string,
    details:  string,
    state?: string,
    timestamps?: {
        start: number,
        end: number
    },
    instance: false
}
export type UnderstandableRPC = {
    type: ActivityType,
    title: string,
    subtitle?: string,
    /**
     * Seconds since epoch
     */
    timestamp?: {
        start: number,
        end: number,
    },
    largeImage?: {
        url: string,
        tooltip?: string
    },
    smallImage?: {
        url: string,
        tooltip?: string
    },
    paused: boolean
}

abstract class Discord {
    connected: boolean = false
    constructor(token_or_appId: string) {}
    destroy() {}
    init() {}
    rpc(data?: UnderstandableRPC) {}
}

export class ServerSideDiscord extends Discord {
    private token:string;
    private ws?:WebSocket;
    override connected:boolean = false
    private pingInverval?:number
    constructor(token: string) {
        log("Using Server Side Discord")
        super(token)
        this.token = token
    }

    
    override destroy() {
        this.ws?.close()
        this.connected = false;
        clearInterval(this.pingInverval)
        log("Client destroyed")
    }
    override init() {
        this.ws = new WebSocket("wss://gateway.discord.gg/?encoding=json&v=9&compress=zlib-stream")
        this.ws.onopen = () => {
            this.connected = true
            log("Client connected")
        }
        this.ws.onclose = () => {
            this.connected = false
            log("Client closed")
        }
        this.ws.onerror = () => {
            this.connected = false
            log("Client disconnected")
        }
        // keep connection alive
        this.pingInverval = setInterval(() => this.ping(), 15000);
        // on first message authenticate
        this.ws.onmessage = () => {
            this.auth()
        }
    }
    private ping() {
        log("ping")
        this.send({"op":1, "d":1})
    }
    private send(data:object) {
        this.ws?.send(
            new Blob([JSON.stringify(data, null, 0)], {
                type: "application/json"
            })
        )
    }
    private auth() {
        log("authenticating")
        this.send({
            "op": 2,
            "d": {
                "token": this.token,
                "capabilities": 161789,
                "properties": {
                    "os": "Linux",
                    "browser": "Chrome",
                    "device": "",
                    "system_locale": "en-US",
                    "has_client_mods": false,
                    "browser_user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                    "browser_version": "134.0.0.0",
                    "os_version": "",
                    "referrer": "",
                    "referring_domain": "",
                    "referrer_current": "",
                    "referring_domain_current": "",
                    "release_channel": "canary",
                    "client_build_number": 391927,
                    "client_event_source": null
                },
                "presence": {
                    "status": "unknown",
                    "since": 0,
                    "activities": [],
                    "afk": false
                },
                "compress": false,
                "client_state": {
                    "guild_versions": {}
                }
            }
        })
        // prevent from spamming authentication
        this.ws!.onmessage = () => {}
        return null;
    }
    private clearRPC() {
        let operation = {
            "op": 3,
            "d": {
                "status": "online",
                "since": 0,
                "activities": [],
                "afk": false
            }
        }
        this.send(operation)
    }
    override rpc(data?: UnderstandableRPC) {
        if (!this.connected) return
        log("RPC update")
        if (!data) {
            return this.clearRPC()
        }
        const realRpc: RPC = {
            app_id: "1363567299948314906",
            type: data.type,
            metadata: {},
            flags: 0,
            name: "Jellyfin",
            details: data.title,
            state: data.subtitle,
            // Serverside RPC cant really do images bc discord stuupid
            // assets: {
            //     large_image: data.largeImage?.url,
            //     large_text: data.largeImage?.tooltip,
            //     small_image: data.smallImage?.url,
            //     small_text: data.smallImage?.tooltip
            // },
            timestamps: !data.paused && data.timestamp ? {
                start: data.timestamp.start * 1000,
                end: data.timestamp.end * 1000
            } : undefined,
            instance: false
        }

        let operation = {
            "op": 3,
            "d": {
                "status": "online",
                "since": 0,
                "activities": [
                    // remove undefined's
                    JSON.parse(JSON.stringify(realRpc))
                ],
                "afk": false
            }
        }
        this.send(operation)
    }
}



export class ClientSideDiscord extends Discord {
    private client:Client;
    override connected:boolean = false; 

    constructor(app_id: string) {
        log("Using Client Side Discord")
        super(app_id);

        this.client = new Client({
            clientId: app_id
        });

        this.client.on("ready", async () => {
            log("Client ready")
            await this.client.user?.clearActivity();
            this.connected = true
        })
        this.client.on("disconnected", () => {
            log("Client Disconnected")
            this.connected = false
        })
        this.client.on("ERROR", () => {
            log("Client Disconnected")
            this.connected = false
        })

        this.client.login()
    }
    override destroy() {
      this.client.destroy()
      this.connected = false;
      log("Client destroyed")
    }
    override rpc(data?: UnderstandableRPC) {
        if (!this.connected) return
        log("RPC update")
        if (!data) return this.client.user?.clearActivity()
        const realData:SetActivity= {
            // @ts-ignore its ok
            type: data.type,
            state: data.subtitle,
            details: data.title,
            smallImageKey: data.smallImage?.url,
            smallImageText: data.smallImage?.tooltip,
            largeImageKey: data.largeImage?.url,
            largeImageText: data.largeImage?.tooltip,
            startTimestamp: data.paused ? undefined : data.timestamp?.start,
            endTimestamp: data.paused ? undefined : data.timestamp?.end
        }        
        this.client.user?.setActivity(realData);
    }
}
