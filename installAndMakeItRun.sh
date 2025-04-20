npm install
deno install
 
echo 
echo 
echo "You need to login to your jellyfin once "
echo 
echo 

deno run --env-file --allow-env --allow-net --allow-read --allow-write main.ts

echo 
echo 
echo 
echo 
echo "Everything should be set up now :)"
echo "Go to where ever to run stuff on boot and use this to start:"
echo 
echo 
echo "cd $(pwd) && deno run --env-file --allow-env --allow-net --allow-read --allow-write main.ts"
echo 
echo 
echo "Have fun!"
