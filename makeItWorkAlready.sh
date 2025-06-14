npm install
deno install
echo

echo "Jellyfin URL:"
read url
echo

echo "Jellayfin Username:"
read user
echo

echo "Jellyfin Password:"
read password
echo

echo "" > .env
echo "jellyfin_url=\"$url\"" >> .env
echo "jellyfin_user=\"$user\"" >> .env
echo "jellyfin_password=\"$password\"" >> .env
echo "serverside=\"$server\"" >> .env
echo "discord_token=\"$token\"" >> .env

echo
echo 
echo 
echo "Use the following command to run at startup"
echo 
echo "cd $(pwd) && deno run --allow-net --allow-env --allow-run --env-file --allow-read --allow-write src/main.ts"
echo 
echo 
echo "Or this when you want to keep the logs"
echo 
echo "cd $(pwd) && deno run --allow-net --allow-env --allow-run --env-file --allow-read --allow-write src/main.ts >> logs"
echo 
echo 
echo "Have Fun!"
