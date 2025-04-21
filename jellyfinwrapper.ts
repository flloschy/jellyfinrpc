import { ActivityType } from "discord-api-types/v10";

let instance: Jellyfin;
export class Jellyfin {
  url: string = "";
  header?: string;
  constructor(url: string) {
    this.url = url;
    instance = this;
  }

  static instance() {
    return instance;
  }

  auth() {
    this.header = this.makeHeader(Deno.env.get("token")!);
  }

  async ping() {
    try {
      const response = await fetch(this.url + "System/Info/Public");
      const data = await response.json();
      return data.ServerName && data.Id;
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
      body: JSON.stringify({ Username, Pw }),
    });

    const data = await response.json();

    const token = data.AccessToken;
    this.header = this.makeHeader(token);

    return token;
  }

  makeHeader(token: string) {
    return "MediaBrowser " +
      'Client="RPC", ' +
      'Device="Chrome", ' +
      'DeviceId="idk", ' +
      'Version="0.0.1", ' +
      `Token="${token}", `;
  }

  async getPlayback() {
    const response = await fetch(this.url + "Sessions", {
      method: "GET",
      headers: {
        Authorization: this.header!,
        "accept-encoding": "identity", // https://github.com/denoland/deno/issues/25992
        "Content-Type": "application/json",
      },
    });

    // workaround bc:https://github.com/denoland/deno/issues/25992
    const data = JSON.parse(new TextDecoder().decode(
      new Deno.Command("curl", {
        args: [
          `-H`,
          `Authorization: ${this.header!}`,
          `https://jellyfin.floschy.dev/Sessions`,
        ],
      }).outputSync().stdout,
    ));

    const session = (data as any[])
      .sort((a, b) =>
        new Date(a.LastActivityDate).getTime() -
        new Date(b.LastActivityDate).getTime()
      )
      .at(-1);

    const playstate = session.PlayState;
    const item = session.NowPlayingItem;

    switch (item.Type) {
      case "Audio": {
        const length = item.RunTimeTicks / 10_000_000 as number;
        const listened = playstate.PositionTicks / 10_000_000 as number;
        const paused = playstate.IsPaused as boolean;
        const itemName = item.Name as string;
        const year = item.ProductionYear as number;
        const artists = item.Artists as string[];
        const kind = item.Type as string;
        const id = item.Id as string;
        const parentId = item.AlbumId as string;
        const artistIds = item.ArtistItems.map((a: any) => a.Id) as string[];
        return {
          id,
          parentId,
          length,
          listened,
          paused,
          itemName,
          year,
          artists,
          artistIds,
          kind,
        };
      }
      case "Episode": {
        const length = item.RunTimeTicks / 10_000_000 as number;
        const listened = playstate.PositionTicks / 10_000_000 as number;
        const paused = playstate.IsPaused as boolean;
        const itemName = item.Name + " | " + item.SeasonName;
        const year =
          Math.round(playstate.PositionTicks / item.RunTimeTicks * 100) +
          "% Progress";
        const artists = [item.SeriesName as string];
        const kind = item.Type as string;
        const id = item.Id as string;
        const parentId = item.ParentLogoItemId as string;
        const artistIds = [] as string[];
        return {
          id,
          parentId,
          length,
          listened,
          paused,
          itemName,
          year,
          artists,
          artistIds,
          kind,
        };
      }
      case "Movie": {
        const length = item.RunTimeTicks / 10_000_000 as number;
        const listened = playstate.PositionTicks / 10_000_000 as number;
        const paused = playstate.IsPaused as boolean;
        const itemName = item.Name as string;
        const year =
          Math.round(playstate.PositionTicks / item.RunTimeTicks * 100) +
          "% Progress";
        const artists = [""];
        const kind = item.Type as string;
        const id = item.Id as string;
        const parentId = item.ParentLogoItemId as string;
        const artistIds = [] as string[];
        return {
          id,
          parentId,
          length,
          listened,
          paused,
          itemName,
          year,
          artists,
          artistIds,
          kind,
        };
      }
    }
  }

  async getActivity() {
    try {
      const playback = await this.getPlayback();
      if (!playback) return false;
      let smallImageKey = undefined;
      for (const id of playback.artistIds) {
        const url = this.url + `Items/${id}/Images/Primary`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: this.header!,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          smallImageKey = url;
          break;
        }
      }

      let largeImageKey;
      for (const id of [playback.id, playback.parentId]) {
        const url = this.url + `Items/${id}/Images/Primary`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: this.header!,
            "Content-Type": "application/json",
          },
        });
        if (response.ok) {
          largeImageKey = url;
          break;
        }
      }

      return {
        details: playback.itemName,
        state: `${playback.artists.join(",")}${
          playback.year ? " (" + playback.year + ")" : ""
        }`,
        type: playback.kind == "Audio"
          ? ActivityType.Listening
          : ActivityType.Streaming,
        startTimestamp: playback.paused
          ? undefined
          : Math.floor(Date.now() / 1000 - playback.listened),
        endTimestamp: playback.paused ? undefined : Math.ceil(
          Date.now() / 1000 + (playback.length - playback.listened),
        ),
        largeImageKey,
        smallImageKey,
      };
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}

export async function loginFlow() {
  let jf;
  while (true) {
    let url = prompt("Server URL: ") ?? "";
    url = url.endsWith("/") ? url : url + "/";
    jf = new Jellyfin(url);
    if (await jf.ping()) break;
    console.log("Server unreachable...");
  }

  let token;
  while (true) {
    const user = prompt("User Name: ") ?? "";
    const pwd = prompt("Password: ") ?? "";
    token = await jf.passwordAuth(user, pwd);
    if (token) break;
    console.log("auth failed...");
  }

  Deno.env.set("url", jf.url);
  Deno.env.set("token", token);
  Deno.writeTextFileSync("./.env", `url=${jf.url}\ntoken=${token}`);
}
