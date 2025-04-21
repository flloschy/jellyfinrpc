import { Client, SetActivity } from "@xhayper/discord-rpc";
import { Jellyfin, loginFlow } from "./jellyfinwrapper.ts";

if (!(Deno.env.has("token") && Deno.env.has("url"))) {
  await loginFlow();
  Deno.exit();
}

function run() {
  console.log("starting");
  const jf = new Jellyfin(Deno.env.get("url")!);
  jf.auth();

  const client = new Client({
    clientId: "1363567299948314906",
  });

  let id: number;
  client.on("ready", () => {
    console.log("alive!");

    let failCounter = 0;
    let idle = false;
    let counter = 0;
    id = setInterval(async () => {
      if (idle && counter == 10) {
        counter = 0;
        const activity = await jf.getActivity();
        if (activity) {
          await client.user?.setActivity(activity as SetActivity);
          idle = false;
        }
      } else if (idle) {
        counter++;
      } else {
        const activity = await jf.getActivity();
        if (activity) {
          failCounter = 0;
          await client.user?.setActivity(activity as SetActivity);
        } else {
          failCounter++;
          await client.user?.clearActivity();
          if (failCounter == 4) {
            idle = true;
          }
        }
      }
    }, 3000);
  });

  client.login();

  const unload = async () => {
    await client.user?.clearActivity();
    await client.destroy();
    clearInterval(id);
  };

  globalThis.addEventListener("unload", unload);

  let timeoutId: number;
  client.on("ERROR", () => {
    unload();
    globalThis.removeEventListener("unload", unload);
    clearTimeout(timeoutId);
    clearInterval(id);
    timeoutId = setTimeout(run, 60000);
    console.log("dead");
  });

  client.on("disconnected", () => {
    globalThis.removeEventListener("unload", unload);
    clearTimeout(timeoutId);
    clearInterval(id);
    timeoutId = setTimeout(run, 60000);
    console.log("dead");
  });
}

run();
