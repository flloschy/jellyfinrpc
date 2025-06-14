import { dc_instance } from "./discord/index.ts";
import { UnderstandableRPC } from "./rpc/rpcTypes.ts";

export function cleanUrl(url: string) {
    const hasTail = url.endsWith("/")
    return hasTail ? url : url + "/"
}


export function execCmd(cmd: string, args: string[]) {
    const command = new Deno.Command(
        cmd,
        {
            args
        });
    const output = command.outputSync().stdout
    const plainText = new TextDecoder().decode(output);
    return plainText;
}

export function envExists(key: string) {
    return Deno.env.has(key) && Deno.env.get(key) != "";
}
export const env = (key: string) => Deno.env.get(key)!;

export function validateEnv() {
    const checks = [
        "jellyfin_url",
        "jellyfin_user",
        "jellyfin_password",
    ]
    checks.forEach((check) => {
        if (envExists(check)) {
            log("env validator", check, "exists and is filled")
            return
        }
        throw Error(`${check} missing in env or doesn't have a value`)
    })
}

function equalsWithMargin(value: number|undefined, target: number|undefined, delta: number) {
    if (value == target) return true
    if (!value || !target) return false
    const max = target + delta;
    const min = target - delta;

    return value >= min && value <= max
}
function equalsObject(obj1?: object, obj2?: object) {
    if (!!obj1 != !!obj2) return false
    return JSON.stringify(obj1) == JSON.stringify(obj2)
}

export function shouldUpdate(currentRpc: UnderstandableRPC) {
    const lastRpc = dc_instance.lastRPC
    if (!lastRpc) return true
    if (currentRpc.type != lastRpc.type) return true;
    if (currentRpc.title != lastRpc.title) return true;
    if (currentRpc.subtitle != lastRpc.subtitle) return true;
    if (currentRpc.paused != lastRpc.paused) return true;
    if (!equalsObject(currentRpc.largeImage, lastRpc.largeImage)) return true;
    if (!equalsObject(currentRpc.smallImage, lastRpc.smallImage)) return true;
    
    if (!!currentRpc.timestamp != !!lastRpc.timestamp) return true;
    if (!equalsWithMargin(currentRpc.timestamp?.start, lastRpc.timestamp?.start, 2)) return true;
    if (!equalsWithMargin(currentRpc.timestamp?.end, lastRpc.timestamp?.end, 2)) return true;

    return false
}


const pad = (x:number) => x.toString().padStart(2, "0")
export function log(source: string, ...data: any[]) {
    const now = new Date()
    const date = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}`
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds().toString().padEnd(4, "0").slice(0, 4)}`
    const datetime = `[${date}][${time}]`
    const origin = `(${source.toUpperCase()}):`
    console.log(datetime, origin, data.join(" "))
}
