
This is a hella light-weight socket server build on the websocket component

You MUST have that module installed for it to work!

Just run 

npm install websocket
npm install mysql@2.0.0-alpha7

to get it compiled and installed, then run the web server like so:

node ./socketServer.js

and you can watch the output for connections, etc.

Be sure to update the connection string in js/application.js as well, if you want to run on your local!

that's: dApplication.socketServer = "ws://bunnyandboar.com:8080";

around about line 31 in js/application.js


