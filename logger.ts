export function log(message: string) {
    const now = new Date()

    const y = now.getFullYear().toString()
    const m = now.getMonth().toString().padStart(2, "0")
    const d = now.getDate().toString().padStart(2, "0")
    
    const hh = now.getHours().toString().padStart(2, "0")
    const mm = now.getMinutes().toString().padStart(2, "0")
    const ss = now.getSeconds().toString().padStart(2, "0")
    const ms = now.getMilliseconds().toString().slice(0, 3).padEnd(4, "0")


    const time = `[${y}-${m}-${d} ${hh}:${mm}:${ss}.${ms}]`
    console.log(`${time} ${message}`)
}
