import { dc_instance } from "../discord/index.ts";
import { getRpcFn } from "../rpc/index.ts";
import { cleanUrl, env, execCmd, log } from "../utility.ts";
import { jf_api_Sessions, jf_api_Users_AuthenticateByName, jf_auth } from "./JellyfinTypes.ts";

export let jf_instance: Jellyfin;

export class Jellyfin {
    url: string = ""
    private token: string = ""
    private get header() {
        return "MediaBrowser " +
               'Client="Jellyfin Discord RPC", ' +
               'Device="Chrome", ' +
               'DeviceId="idk", ' +
               'Version="3.0.0", ' +
               `Token="${this.token}"`;
    }


    constructor(url: string, auth:jf_auth) {
        this.url = cleanUrl(url);

        this.userLogin(auth)

        jf_instance = this;
    }

    private async post(path: string, data: object) {
        const headers = {
                Authorization: this.header,
                "Content-Type": "application/json"
        }
        const body = JSON.stringify(data);
        const response = await fetch(this.url + path, {
            method: "POST",
            headers,
            body
        })
        return await response.json()
    }
    async get(path: string) {
        const headers = {
                Authorization: this.header,
                "Content-Type": "application/json"
        }

        return await fetch(this.url + path, {
            method: "GET",
            headers
        });
    }

    private async userLogin(auth:jf_auth) {
        await this.post("Users/AuthenticateByName", auth)
        .then((data: jf_api_Users_AuthenticateByName) => {
                if (this.token == undefined) throw Error("Login Failed")
                log("Jellyfin", "Login successful!")
                this.token = data.AccessToken;
            })
            .catch((e) => {throw e})
    }

    private fetchSessions() {
        const data = execCmd("curl", [
            `-H`,
            `Authorization: ${this.header}`,
            `${this.url}Sessions?activeWithinSeconds=15`,
        ])
        const json = JSON.parse(data) as jf_api_Sessions[];

        const userSessions = json.filter((session) => session.UserName == env("jellyfin_user"))

        const sessions = userSessions.sort((a, b) => 
            new Date(a.LastPlaybackCheckIn).getTime() - 
            new Date(b.LastPlaybackCheckIn).getTime()
        )

        return sessions.at(-1);
    }

    async getRpc() {
        try {
            const session = this.fetchSessions()
            if (!session) {
                log("Jellyfin", "Didn't found any sessions")
                dc_instance.updateRpc() // clear
                return
            };
    
            const fn = getRpcFn(session);
            return await fn()
        } catch {/*Empty*/}
    }



}
