import { ActivityType } from "discord-api-types/v10";

let instance: Jellyfin;
export class Jellyfin {
    url: string = ""
    header?: string;
    constructor(url: string) {
        this.url = url
        instance = this 
    }

    static instance() {return instance}

    auth() {
        this.header = this.makeHeader(Deno.env.get("token")!)
    }
    
    async ping() {
        try {
            const response = await fetch(this.url + "System/Info/Public");
            const data = await response.json()
            return data.ServerName && data.Id
        } catch {
            return false;
        }
    }

    async passwordAuth(Username: string, Pw: string) {
        const response = await fetch(this.url + "Users/AuthenticateByName", {
            method: "POST",
            headers: {
                Authorization: this.makeHeader(""),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({Username, Pw})
        });

        const data = await response.json()

        const token = data.AccessToken
        this.header = this.makeHeader(token)

        return token;
    }

    makeHeader(token:string) {
        return "MediaBrowser " +
               'Client="RPC", ' +
               'Device="Chrome", ' +
               'DeviceId="idk", ' +
               'Version="0.0.1", ' +
               `Token="${token}", `
    }

    async getPlayback() {
        const response = await fetch(this.url + "Sessions", {
            method: "GET",
            headers: {
                Authorization: this.header!,
                "Content-Type": "application/json",
            },
        })

        const data = await response.json()
        const session = (data as any[])
            .filter(e => e.IsActive)
            .sort((a, b) => new Date(a.LastActivityDate).getTime() - new Date(b.LastActivityDate).getTime())
            .at(-1)
        
        const playstate = session.PlayState
        const item = session.NowPlayingItem
        
        switch (item.Type) {
            case "Audio": {
                const length = item.RunTimeTicks / 10_000_000 as number
                const listened = playstate.PositionTicks / 10_000_000 as number
                const paused = playstate.IsPaused as boolean
                const itemName = item.Name as string
                const year = item.ProductionYear as number
                const artists = item.Artists as string[]
                const kind = item.Type as string
                const id = item.Id as string
                const artistId = item.ArtistItems[0].Id
                return {
                    id,
                    length,
                    listened,
                    paused,
                    itemName,
                    year,
                    artists,
                    artistId,
                    kind
                }
            }
            case "Episode": {
                const length = item.RunTimeTicks / 10_000_000 as number
                const listened = playstate.PositionTicks / 10_000_000 as number
                const paused = playstate.IsPaused as boolean
                const itemName = item.Name as string
                const year = Math.round(playstate.PositionTicks / item.RunTimeTicks * 100 ) + "% Watched"
                const artists = [(item.SeriesName as string) + " | " + (item.SeasonName as string)]
                const kind = item.Type as string
                const id = item.Id as string
                const artistId = undefined
                return {
                    id,
                    length,
                    listened,
                    paused,
                    itemName,
                    year,
                    artists,
                    artistId,
                    kind
                }
            }
            case "Movie": {
                const length = item.RunTimeTicks / 10_000_000 as number
                const listened = playstate.PositionTicks / 10_000_000 as number
                const paused = playstate.IsPaused as boolean
                const itemName = item.Name as string
                const year = Math.round(playstate.PositionTicks / item.RunTimeTicks * 100) + "% Watched"
                const artists = [""]
                const kind = item.Type as string
                const id = item.Id as string
                const artistId = undefined
                return {
                    id,
                    length,
                    listened,
                    paused,
                    itemName,
                    year,
                    artists,
                    artistId,
                    kind
                }
            }
        }
    }

    async getActivity() {
        try {
            const playback = await this.getPlayback();
            if (!playback) return false;
            return {
                details: playback.itemName,
                state: `${playback.artists.join(",")}${playback.year ? " (" + playback.year + ")" : ""}`,
                type: playback.kind == "Audio" ? ActivityType.Listening : ActivityType.Streaming,
                startTimestamp: playback.paused ? undefined : Math.floor(Date.now()/1000 - playback.listened),
                endTimestamp: playback.paused ? undefined : Math.ceil(Date.now()/1000 + (playback.length - playback.listened)),
                largeImageKey: this.url + `Items/${playback.id}/Images/Primary`,
                smallImageKey: playback.artistId ? this.url + `Items/${playback.artistId}/Images/Primary` : undefined
            }
        } catch (e) {
            return false;
        }
    }
}



export async function loginFlow() {
    let jf;
    while (true) {
        let url = prompt("Server URL: ") ?? ""
        url = url.endsWith("/") ? url : url + "/"
        jf = new Jellyfin(url);
        if (await jf.ping()) break;
        console.log("Server unreachable...")
    }

    let token;
    while (true) {
        const user = prompt("User Name: ") ?? ""
        const pwd = prompt("Password: ") ?? ""
        token = await jf.passwordAuth(user, pwd)
        if (token) break;
        console.log("auth failed...");
    }

    Deno.env.set("url", jf.url);
    Deno.env.set("token", token);
    Deno.writeTextFileSync("./.env", `url=${jf.url}\ntoken=${token}`)
}
