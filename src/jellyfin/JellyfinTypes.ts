export type jf_auth = {Username: string, Pw: string}
export type jf_api_Users_AuthenticateByName = {
    [key: string]: any,
    AccessToken: string
}
export type jf_api_Sessions = {
    [key: string]: any,
    LastPlaybackCheckIn: string,
    UserName: string,
    NowPlayingItem: {
        Id: string, 
        AlbumId: string,
        ParentLogoItemId: string,
        Album: string,
        Type: "Audio" | "Movie" | "Episode",
        Name: string,
        SeriesName: string,
        SeasonName: string,
        Artists: string[],
        ArtistItems: {
            Id: string,
            Name: string
        }[],
        RunTimeTicks: number,
    },
    PlayState:  {
        IsPaused: boolean
        PositionTicks: number
    },
}
