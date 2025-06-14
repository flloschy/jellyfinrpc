import { ActivityType } from "discord-api-types/v10";

export type rpc_timestamp = {
    start: number;
    end: number;
};

export type UnderstandableRPC = {
    type: ActivityType;
    title: string;
    subtitle?: string;
    /**
     * Seconds since epoch
     */
    timestamp?: rpc_timestamp;
    largeImage?: {
        url: string;
        tooltip?: string;
    };
    smallImage?: {
        url: string;
        tooltip?: string;
    };
    paused: boolean;
};

export type rpc_imagePair = { itemId: string; itemName?: string };
