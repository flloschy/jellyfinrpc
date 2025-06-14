import { jf_instance } from "../jellyfin/index.ts";
import { jf_api_Sessions } from "../jellyfin/JellyfinTypes.ts";
import { rpc_imagePair, rpc_timestamp, UnderstandableRPC } from "./rpcTypes.ts";
import { ActivityType } from "discord-api-types/v10";

export function getRpcFn(
    session: jf_api_Sessions,
): () => Promise<UnderstandableRPC> {
    const types = {
        "Audio": async () => await audio(session),
        "Movie": async () => await movie(session),
        "Episode": async () => await episode(session),
    };
    return types[session.NowPlayingItem.Type];
}
function makeTimestamp(session: jf_api_Sessions) {
    const currentTicks = session.PlayState.PositionTicks / 10_000_000;
    const totalTicks = session.NowPlayingItem.RunTimeTicks / 10_000_000;
    const now = Date.now() / 1000;

    return {
        start: Math.floor(now - currentTicks),
        end: Math.ceil(now + (totalTicks - currentTicks)),
    } as rpc_timestamp;
}
const pausedImg = (paused: boolean) =>
    paused ? { url: "paused", tooltip: "paused" } : undefined;

async function findImage(images: rpc_imagePair[]) {
    let url;
    let tooltip;

    for (const img of images) {
        try {
            const path = `Items/${img.itemId}/Images/Primary`;
            const response = await jf_instance.get(path);
            if (response.ok) {
                url = jf_instance.url + path;
                tooltip = img.itemName;
                break; // quit early to keep priority order
            }
        } catch { /*Empty*/ }
    }

    if (!url) return undefined;
    return {
        url,
        tooltip,
    };
}

async function audio(session: jf_api_Sessions): Promise<UnderstandableRPC> {
    const name = session.NowPlayingItem.Name;
    const artists = session.NowPlayingItem.Artists.join(", ");
    const paused = session.PlayState.IsPaused;
    const timestamp = makeTimestamp(session);

    const largeImage = await findImage([
        {
            itemId: session.NowPlayingItem.Id,
            itemName: session.NowPlayingItem.Name,
        },
        {
            itemId: session.NowPlayingItem.AlbumId,
            itemName: session.NowPlayingItem.Album,
        },
    ]);

    const smallImage = paused ? pausedImg(true) : await findImage(
        session.NowPlayingItem.ArtistItems.map((a) => ({
            itemId: a.Id,
            itemName: a.Name,
        })),
    );

    return {
        type: ActivityType.Listening,
        title: name,
        subtitle: artists,
        timestamp,
        paused,
        largeImage,
        smallImage,
    };
}

async function movie(session: jf_api_Sessions): Promise<UnderstandableRPC> {
    const name = session.NowPlayingItem.Name;
    const paused = session.PlayState.IsPaused;

    const timestamp = makeTimestamp(session);

    const largeImage = await findImage([
        { itemId: session.NowPlayingItem.Id },
        { itemId: session.NowPlayingItem.ParentLogoItemId },
    ]);

    const smallImage = pausedImg(paused);

    return {
        type: ActivityType.Watching,
        title: name,
        subtitle: undefined,
        timestamp,
        paused,
        largeImage,
        smallImage,
    };
}

async function episode(session: jf_api_Sessions): Promise<UnderstandableRPC> {
    const name = session.NowPlayingItem.Name;
    const season = session.NowPlayingItem.SeasonName;
    const paused = session.PlayState.IsPaused;
    const timestamp = makeTimestamp(session);

    const largeImage = await findImage([
        {
            itemId: session.NowPlayingItem.Id,
            itemName: session.NowPlayingItem.SeriesName,
        },
        {
            itemId: session.NowPlayingItem.ParentLogoItemId,
            itemName: session.NowPlayingItem.SeriesName,
        },
    ]);

    const smallImage = pausedImg(paused);

    return {
        type: ActivityType.Watching,
        title: name,
        subtitle: season,
        timestamp,
        paused,
        largeImage,
        smallImage,
    };
}
