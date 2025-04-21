import { ActivityType } from "discord-api-types/v10";
import { UnderstandableRPC } from "./Discord.ts";

export class Jellyfin {
    private url:string
    private token:string=""
    constructor(url: string, auth?:{username:string, password:string}) {
        this.url = url.endsWith("/") ? url : url + "/"

        if (auth) {
            this.post("Users/AuthenticateByName", {Username: auth.username, Pw: auth.password})
            .then((data) => {
                this.token = data.AccessToken;
                if (this.token == undefined) throw Error("Login not accepted.")
            })
            .catch((e) => {console.error(e); throw Error("Login not accepted.")});
        } else {
            this.token = Deno.env.get("token")!
        }
    }

    private async post(path: string, data: object) {
        const response = await fetch(this.url + path, {
            method: "POST",
            headers: {
                Authorization: this.header,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        const json = await response.json()
        return json
    }

    private async get(path: string) {
        const response = await fetch(this.url + path, {
            method: "GET",
            headers: {
                Authorization: this.header,
                "Content-Type": "application/json"
            }
        })
        return response
    }

    private get header() {
        return "MediaBrowser " +
               'Client="RPC", ' +
               'Device="Chrome", ' +
               'DeviceId="idk", ' +
               'Version="2.0.0", ' +
               `Token="${this.token}"`;
    }

    private session() {
        // workaround bc:https://github.com/denoland/deno/issues/25992
        const data = JSON.parse(new TextDecoder().decode(
            new Deno.Command("curl", {
            args: [
                `-H`,
                `Authorization: ${this.header!}`,
                `${this.url}Sessions?activeWithinSeconds=15`,
            ],
            }).outputSync().stdout,
        ));
        const session = (data as any[])
            .sort((a, b) =>
                new Date(a.LastPlaybackCheckIn).getTime() -
                new Date(b.LastPlaybackCheckIn).getTime()
            )
            .at(-1);

        return session
    }

    private async testIfImageExists(arr: string[][]) {
        let url;
        let tooltip;
        for (const [id, text] of arr) {
            try {
                const path = `Items/${id}/Images/Primary`
                const response = await this.get(path,)
                if (response.ok) {
                    url = this.url + path
                    tooltip ??= text
                    break;
                }
            } catch {/*Empty*/}
        }

        if (!url) return undefined
        return {
            url,
            tooltip
        }
    }

    private async rpcFromAudio(session: any):Promise<UnderstandableRPC> {
        const type = ActivityType.Listening
        const title = session.NowPlayingItem.Name as string;
        const subtitle = session.NowPlayingItem.Artists.join(", ") as string
        const paused = session.PlayState.IsPaused as boolean

        const now = Date.now()/1000
        const timestamp = {
            start: Math.floor(now - session.PlayState.PositionTicks/10_000_000),
            end: Math.ceil(now + (session.NowPlayingItem.RunTimeTicks - session.PlayState.PositionTicks)/10_000_000)
        }
        const largeImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : await this.testIfImageExists([
                [session.NowPlayingItem.Id, session.NowPlayingItem.Name],
                [session.NowPlayingItem.AlbumId, session.NowPlayingItem.Album],
            ])

        const smallImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : paused
            ? {url:"pause", tooltip:"paused"}
            : await this.testIfImageExists(
                (session.NowPlayingItem.ArtistItems as any[]).map((a) => {return [a.Id, a.Name]}))

        return {
            type,
            title,
            subtitle,
            timestamp,
            largeImage,
            smallImage,
            paused
        }
    }
    private async rpcFromMovie(session:any):Promise<UnderstandableRPC> {
        const type = ActivityType.Watching
        const title = session.NowPlayingItem.Name as string
        const subtitle = undefined
        const paused = session.PlayState.IsPaused as boolean

        const now = Date.now()/1000
        const timestamp = {
            start: Math.floor(now - session.PlayState.PositionTicks/10_000_000),
            end: Math.ceil(now + (session.NowPlayingItem.RunTimeTicks - session.PlayState.PositionTicks)/10_000_000)
        }
        const largeImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : await this.testIfImageExists([
                [session.NowPlayingItem.Id, undefined],
                [session.NowPlayingItem.ParentLogoItemId, undefined]
            ])

        const smallImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : paused
            ? {url:"pause", tooltip:"paused"}
            : undefined
        
        return {
            type,
            title,
            subtitle,
            timestamp,
            largeImage,
            smallImage,
            paused
        }
    }

    private async rpcFromEpisode(session:any):Promise<UnderstandableRPC> {
        const type = ActivityType.Watching
        const title = session.NowPlayingItem.Name as string
        const subtitle = session.NowPlayingItem.SeasonName as string
        const paused = session.PlayState.IsPaused as boolean

        const now = Date.now()/1000
        const timestamp = {
            start: Math.floor(now - session.PlayState.PositionTicks/10_000_000),
            end: Math.ceil(now + (session.NowPlayingItem.RunTimeTicks - session.PlayState.PositionTicks)/10_000_000)
        }
        const largeImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : await this.testIfImageExists([
                [session.NowPlayingItem.Id, session.NowPlayingItem.SeriesName],
                [session.NowPlayingItem.ParentLogoItemId, session.NowPlayingItem.SeriesName]
            ])

        const smallImage = Deno.env.get("serverside")! == "true"
            ? undefined
            : paused
            ? {url:"pause", tooltip:"paused"}
            : undefined

        return {
            type,
            title,
            subtitle,
            timestamp,
            largeImage,
            smallImage,
            paused
        }
    }
    async getRpc()  {
        try {
            const session = this.session()
            if (!session) return;

            switch (session.NowPlayingItem.Type) {
                case "Audio": return await this.rpcFromAudio(session);
                case "Movie": return await this.rpcFromMovie(session);
                case "Episode": return await this.rpcFromEpisode(session);
            }
        } catch {}
        return
    }

}
